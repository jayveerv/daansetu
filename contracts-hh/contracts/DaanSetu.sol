// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DaanSetu - milestone-escrow crowdfunding for social causes
/// @notice Donations are held by this contract, not sent to the creator.
///         The creator unlocks money one milestone at a time, and donors
///         (weighted by how much they gave) can block a release by voting
///         against it. If the goal is missed, or the campaign is cancelled,
///         donors claim back their share of whatever is still locked.
contract DaanSetu {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum MilestoneState { Pending, Voting, Released, Rejected }
    enum Status { Active, Funded, Failed, Cancelled, Completed }

    struct Milestone {
        string title;
        uint256 amount;
        MilestoneState state;
        uint64 voteEnd;
        uint256 yesWeight;
        uint256 noWeight;
        uint32 round;
    }

    struct Campaign {
        address payable creator;
        string title;
        string story;
        string category;
        string imageUrl;
        uint256 goal;
        uint64 deadline;
        uint64 createdAt;
        uint64 lastActivity;
        uint256 raised;
        uint256 released;
        uint256 refundPool;
        uint8 currentMilestone;
        uint8 milestoneCount;
        uint8 rejections;
        bool cancelled;
        uint32 donorCount;
    }

    struct Donation {
        address donor;
        uint256 amount;
        uint64 time;
        string note;
    }

    struct Update {
        string text;
        uint64 time;
    }

    // ------------------------------------------------------------------
    // Config & storage
    // ------------------------------------------------------------------

    uint8 public constant MAX_MILESTONES = 5;
    uint8 public constant MAX_REJECTIONS = 2;
    uint64 public constant MAX_DURATION = 180 days;

    /// @notice How long donors have to vote on a release request.
    uint64 public immutable votingPeriod;
    /// @notice If a funded campaign sees no creator activity for this long,
    ///         any donor can cancel it and unlock refunds.
    uint64 public immutable inactivityPeriod;

    uint256 public campaignCount;
    uint256 public totalRaisedAllTime;

    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(uint256 => Donation[]) private _donations;
    mapping(uint256 => Update[]) private _updates;
    mapping(uint256 => mapping(address => uint256)) public contributionOf;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(bytes32 => bool) private _voted;

    bool private _locked;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint64 deadline);
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event ReleaseRequested(uint256 indexed id, uint8 milestone, uint64 voteEnd);
    event Voted(uint256 indexed id, uint8 milestone, address indexed donor, bool approve, uint256 weight);
    event MilestoneReleased(uint256 indexed id, uint8 milestone, uint256 amount);
    event MilestoneRejected(uint256 indexed id, uint8 milestone);
    event CampaignCancelled(uint256 indexed id, uint256 refundPool);
    event Refunded(uint256 indexed id, address indexed donor, uint256 amount);
    event UpdatePosted(uint256 indexed id, string text);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error BadInput(string reason);
    error NotCreator();
    error NotAllowed(string reason);
    error TransferFailed();

    modifier nonReentrant() {
        if (_locked) revert NotAllowed("reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    modifier exists(uint256 id) {
        if (id >= campaignCount) revert BadInput("no such campaign");
        _;
    }

    constructor(uint64 votingPeriod_, uint64 inactivityPeriod_) {
        if (votingPeriod_ == 0 || inactivityPeriod_ == 0) revert BadInput("periods must be > 0");
        votingPeriod = votingPeriod_;
        inactivityPeriod = inactivityPeriod_;
    }

    // ------------------------------------------------------------------
    // Creator actions
    // ------------------------------------------------------------------

    /// @param milestoneTitles what each tranche of money is for
    /// @param milestoneAmounts wei per milestone; they must add up to the goal
    function createCampaign(
        string calldata title,
        string calldata story,
        string calldata category,
        string calldata imageUrl,
        uint64 deadline,
        string[] calldata milestoneTitles,
        uint256[] calldata milestoneAmounts
    ) external returns (uint256 id) {
        uint256 n = milestoneTitles.length;
        if (bytes(title).length == 0 || bytes(title).length > 100) revert BadInput("title length");
        if (bytes(story).length > 4000) revert BadInput("story too long");
        if (bytes(category).length == 0 || bytes(category).length > 40) revert BadInput("category");
        if (bytes(imageUrl).length > 500) revert BadInput("image url too long");
        if (deadline <= block.timestamp || deadline > block.timestamp + MAX_DURATION) revert BadInput("deadline");
        if (n == 0 || n > MAX_MILESTONES || n != milestoneAmounts.length) revert BadInput("milestones");

        uint256 goal;
        for (uint256 i = 0; i < n; i++) {
            if (milestoneAmounts[i] == 0) revert BadInput("milestone amount is zero");
            if (bytes(milestoneTitles[i]).length == 0 || bytes(milestoneTitles[i]).length > 120) revert BadInput("milestone title");
            goal += milestoneAmounts[i];
            _milestones[campaignCount].push(
                Milestone(milestoneTitles[i], milestoneAmounts[i], MilestoneState.Pending, 0, 0, 0, 0)
            );
        }

        id = campaignCount++;
        Campaign storage c = _campaigns[id];
        c.creator = payable(msg.sender);
        c.title = title;
        c.story = story;
        c.category = category;
        c.imageUrl = imageUrl;
        c.goal = goal;
        c.deadline = deadline;
        c.createdAt = uint64(block.timestamp);
        c.lastActivity = uint64(block.timestamp);
        c.milestoneCount = uint8(n);

        emit CampaignCreated(id, msg.sender, title, goal, deadline);
    }

    /// @notice Ask donors to approve releasing the next milestone's money.
    function requestRelease(uint256 id) external exists(id) {
        Campaign storage c = _campaigns[id];
        if (msg.sender != c.creator) revert NotCreator();
        if (status(id) != Status.Funded) revert NotAllowed("campaign not funded");
        Milestone storage m = _milestones[id][c.currentMilestone];
        if (m.state != MilestoneState.Pending && m.state != MilestoneState.Rejected) revert NotAllowed("vote already open");

        m.state = MilestoneState.Voting;
        m.voteEnd = uint64(block.timestamp) + votingPeriod;
        m.yesWeight = 0;
        m.noWeight = 0;
        m.round += 1;
        c.lastActivity = uint64(block.timestamp);
        emit ReleaseRequested(id, c.currentMilestone, m.voteEnd);
    }

    function postUpdate(uint256 id, string calldata text) external exists(id) {
        Campaign storage c = _campaigns[id];
        if (msg.sender != c.creator) revert NotCreator();
        if (bytes(text).length == 0 || bytes(text).length > 1000) revert BadInput("update length");
        _updates[id].push(Update(text, uint64(block.timestamp)));
        c.lastActivity = uint64(block.timestamp);
        emit UpdatePosted(id, text);
    }

    /// @notice Creator walks away; whatever is still locked goes back to donors.
    function cancel(uint256 id) external exists(id) {
        if (msg.sender != _campaigns[id].creator) revert NotCreator();
        Status s = status(id);
        if (s == Status.Cancelled || s == Status.Completed || s == Status.Failed) revert NotAllowed("cannot cancel now");
        _cancel(id);
    }

    // ------------------------------------------------------------------
    // Donor actions
    // ------------------------------------------------------------------

    function donate(uint256 id, string calldata note) external payable exists(id) nonReentrant {
        Campaign storage c = _campaigns[id];
        if (status(id) != Status.Active) revert NotAllowed("not accepting donations");
        if (msg.value == 0) revert BadInput("zero donation");
        if (msg.value > c.goal - c.raised) revert BadInput("more than remaining goal");
        if (bytes(note).length > 200) revert BadInput("note too long");

        if (contributionOf[id][msg.sender] == 0) c.donorCount += 1;
        contributionOf[id][msg.sender] += msg.value;
        c.raised += msg.value;
        totalRaisedAllTime += msg.value;
        _donations[id].push(Donation(msg.sender, msg.value, uint64(block.timestamp), note));
        emit Donated(id, msg.sender, msg.value);
    }

    /// @notice Vote on the open release request. Weight = amount you donated.
    function vote(uint256 id, bool approve) external exists(id) {
        Campaign storage c = _campaigns[id];
        uint256 weight = contributionOf[id][msg.sender];
        if (weight == 0) revert NotAllowed("only donors can vote");
        Milestone storage m = _milestones[id][c.currentMilestone];
        if (m.state != MilestoneState.Voting || block.timestamp >= m.voteEnd) revert NotAllowed("no open vote");
        bytes32 key = keccak256(abi.encode(id, c.currentMilestone, m.round, msg.sender));
        if (_voted[key]) revert NotAllowed("already voted");
        _voted[key] = true;
        if (approve) m.yesWeight += weight;
        else m.noWeight += weight;
        emit Voted(id, c.currentMilestone, msg.sender, approve, weight);
    }

    /// @notice Close a vote once its time is up. Anyone can call this.
    ///         The release passes unless "no" outweighs "yes" (silence = consent).
    function finalizeVote(uint256 id) external exists(id) nonReentrant {
        Campaign storage c = _campaigns[id];
        uint8 idx = c.currentMilestone;
        Milestone storage m = _milestones[id][idx];
        if (m.state != MilestoneState.Voting) revert NotAllowed("no open vote");
        if (block.timestamp < m.voteEnd) revert NotAllowed("vote still running");

        if (m.noWeight > m.yesWeight) {
            m.state = MilestoneState.Rejected;
            c.rejections += 1;
            emit MilestoneRejected(id, idx);
            if (c.rejections >= MAX_REJECTIONS) _cancel(id);
            return;
        }

        m.state = MilestoneState.Released;
        c.released += m.amount;
        c.currentMilestone = idx + 1;
        c.lastActivity = uint64(block.timestamp);
        emit MilestoneReleased(id, idx, m.amount);
        (bool ok, ) = c.creator.call{value: m.amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Donor protection: a funded campaign whose creator has gone
    ///         silent for `inactivityPeriod` can be cancelled by any donor.
    function cancelForInactivity(uint256 id) external exists(id) {
        Campaign storage c = _campaigns[id];
        if (contributionOf[id][msg.sender] == 0) revert NotAllowed("only donors");
        if (status(id) != Status.Funded) revert NotAllowed("campaign not funded");
        if (_milestones[id][c.currentMilestone].state == MilestoneState.Voting) revert NotAllowed("vote open");
        if (block.timestamp < c.lastActivity + inactivityPeriod) revert NotAllowed("creator still active");
        _cancel(id);
    }

    function claimRefund(uint256 id) external exists(id) nonReentrant {
        uint256 amount = refundableOf(id, msg.sender);
        if (amount == 0) revert NotAllowed("nothing to refund");
        refundClaimed[id][msg.sender] = true;
        emit Refunded(id, msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function status(uint256 id) public view exists(id) returns (Status) {
        Campaign storage c = _campaigns[id];
        if (c.cancelled) return Status.Cancelled;
        if (c.raised >= c.goal) {
            return c.currentMilestone >= c.milestoneCount ? Status.Completed : Status.Funded;
        }
        if (block.timestamp >= c.deadline) return Status.Failed;
        return Status.Active;
    }

    function refundableOf(uint256 id, address donor) public view exists(id) returns (uint256) {
        uint256 given = contributionOf[id][donor];
        if (given == 0 || refundClaimed[id][donor]) return 0;
        Status s = status(id);
        if (s == Status.Failed) return given;
        if (s == Status.Cancelled) {
            Campaign storage c = _campaigns[id];
            return (given * c.refundPool) / c.raised;
        }
        return 0;
    }

    function getCampaign(uint256 id) external view exists(id) returns (Campaign memory) {
        return _campaigns[id];
    }

    function getMilestones(uint256 id) external view exists(id) returns (Milestone[] memory) {
        return _milestones[id];
    }

    function getUpdates(uint256 id) external view exists(id) returns (Update[] memory) {
        return _updates[id];
    }

    function donationCount(uint256 id) external view exists(id) returns (uint256) {
        return _donations[id].length;
    }

    /// @notice Newest-first page of the public donation ledger.
    function getDonations(uint256 id, uint256 offset, uint256 limit)
        external
        view
        exists(id)
        returns (Donation[] memory page)
    {
        Donation[] storage all = _donations[id];
        uint256 len = all.length;
        if (offset >= len) return new Donation[](0);
        uint256 n = len - offset < limit ? len - offset : limit;
        page = new Donation[](n);
        for (uint256 i = 0; i < n; i++) page[i] = all[len - 1 - offset - i];
    }

    function hasVoted(uint256 id, address donor) external view exists(id) returns (bool) {
        Campaign storage c = _campaigns[id];
        if (c.currentMilestone >= c.milestoneCount) return false;
        Milestone storage m = _milestones[id][c.currentMilestone];
        return _voted[keccak256(abi.encode(id, c.currentMilestone, m.round, donor))];
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _cancel(uint256 id) private {
        Campaign storage c = _campaigns[id];
        c.cancelled = true;
        c.refundPool = c.raised - c.released;
        if (c.currentMilestone < c.milestoneCount) {
            Milestone storage m = _milestones[id][c.currentMilestone];
            if (m.state == MilestoneState.Voting) m.state = MilestoneState.Rejected;
        }
        emit CampaignCancelled(id, c.refundPool);
    }
}
