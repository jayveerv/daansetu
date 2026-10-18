const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (v) => ethers.parseEther(v);
const DAY = 24 * 60 * 60;
const VOTE = 3 * DAY;
const IDLE = 30 * DAY;

describe("DaanSetu", function () {
  let ds, creator, a, b, c;

  async function create(overrides = {}) {
    const now = await time.latest();
    const o = {
      title: "Clean water for Dahod village",
      story: "Borewell + filter",
      category: "Health",
      image: "",
      deadline: now + 10 * DAY,
      titles: ["Borewell", "Filter plant"],
      amounts: [E("1"), E("2")],
      ...overrides,
    };
    await ds.connect(creator).createCampaign(o.title, o.story, o.category, o.image, o.deadline, o.titles, o.amounts);
    return (await ds.campaignCount()) - 1n;
  }

  beforeEach(async () => {
    [creator, a, b, c] = await ethers.getSigners();
    ds = await (await ethers.getContractFactory("DaanSetu")).deploy(VOTE, IDLE);
  });

  it("creates a campaign whose goal is the sum of milestones", async () => {
    const id = await create();
    const camp = await ds.getCampaign(id);
    expect(camp.goal).to.equal(E("3"));
    expect(camp.milestoneCount).to.equal(2);
    expect(await ds.status(id)).to.equal(0); // Active
  });

  it("rejects bad input", async () => {
    const now = await time.latest();
    await expect(create({ title: "" })).to.be.revertedWithCustomError(ds, "BadInput");
    await expect(create({ deadline: now - 1 })).to.be.revertedWithCustomError(ds, "BadInput");
    await expect(create({ titles: ["x"], amounts: [E("1"), E("1")] })).to.be.revertedWithCustomError(ds, "BadInput");
    await expect(create({ titles: ["x"], amounts: [0n] })).to.be.revertedWithCustomError(ds, "BadInput");
  });

  it("holds donations in escrow and caps at goal", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "jai ho", { value: E("1") });
    expect(await ethers.provider.getBalance(await ds.getAddress())).to.equal(E("1"));
    await expect(ds.connect(b).donate(id, "", { value: E("2.5") })).to.be.revertedWithCustomError(ds, "BadInput");
    await ds.connect(b).donate(id, "", { value: E("2") });
    expect(await ds.status(id)).to.equal(1); // Funded
    await expect(ds.connect(c).donate(id, "", { value: 1n })).to.be.revertedWithCustomError(ds, "NotAllowed");
    const page = await ds.getDonations(id, 0, 10);
    expect(page.length).to.equal(2);
    expect(page[0].donor).to.equal(b.address); // newest first
    expect((await ds.getCampaign(id)).donorCount).to.equal(2);
  });

  it("full refund when goal is missed", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "", { value: E("1") });
    await time.increase(11 * DAY);
    expect(await ds.status(id)).to.equal(2); // Failed
    expect(await ds.refundableOf(id, a.address)).to.equal(E("1"));
    await expect(ds.connect(a).claimRefund(id)).to.changeEtherBalance(a, E("1"));
    await expect(ds.connect(a).claimRefund(id)).to.be.revertedWithCustomError(ds, "NotAllowed");
  });

  it("releases a milestone after vote (silence = approve)", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "", { value: E("3") });
    await expect(ds.connect(a).requestRelease(id)).to.be.revertedWithCustomError(ds, "NotCreator");
    await ds.connect(creator).requestRelease(id);
    await expect(ds.finalizeVote(id)).to.be.revertedWithCustomError(ds, "NotAllowed");
    await time.increase(VOTE + 1);
    await expect(ds.connect(c).finalizeVote(id)).to.changeEtherBalance(creator, E("1"));
    const camp = await ds.getCampaign(id);
    expect(camp.released).to.equal(E("1"));
    expect(camp.currentMilestone).to.equal(1);
  });

  it("weighted voting: a bigger donor can block a release", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "", { value: E("1") });
    await ds.connect(b).donate(id, "", { value: E("2") });
    await ds.connect(creator).requestRelease(id);
    await ds.connect(a).vote(id, true);
    await ds.connect(b).vote(id, false);
    await expect(ds.connect(b).vote(id, false)).to.be.revertedWithCustomError(ds, "NotAllowed");
    await expect(ds.connect(c).vote(id, true)).to.be.revertedWithCustomError(ds, "NotAllowed");
    expect(await ds.hasVoted(id, b.address)).to.equal(true);
    await time.increase(VOTE + 1);
    await ds.finalizeVote(id);
    const ms = await ds.getMilestones(id);
    expect(ms[0].state).to.equal(3); // Rejected
    expect(await ds.hasVoted(id, b.address)).to.equal(true);
    // re-request opens a fresh round where everyone may vote again
    await ds.connect(creator).requestRelease(id);
    expect(await ds.hasVoted(id, b.address)).to.equal(false);
  });

  it("two rejections cancel the campaign; donors get pro-rata refunds of what is left", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "", { value: E("1") });
    await ds.connect(b).donate(id, "", { value: E("2") });
    // milestone 0 approved -> 1 ETH released, 2 ETH left
    await ds.connect(creator).requestRelease(id);
    await time.increase(VOTE + 1);
    await ds.finalizeVote(id);
    for (let i = 0; i < 2; i++) {
      await ds.connect(creator).requestRelease(id);
      await ds.connect(b).vote(id, false);
      await time.increase(VOTE + 1);
      await ds.finalizeVote(id);
    }
    expect(await ds.status(id)).to.equal(3); // Cancelled
    // a gave 1/3, b gave 2/3 of a 2 ETH pool
    expect(await ds.refundableOf(id, a.address)).to.equal(E("2") / 3n);
    await expect(ds.connect(b).claimRefund(id)).to.changeEtherBalance(b, (E("2") * 2n) / 3n);
  });

  it("completes after every milestone is released", async () => {
    const id = await create();
    await ds.connect(a).donate(id, "", { value: E("3") });
    for (let i = 0; i < 2; i++) {
      await ds.connect(creator).requestRelease(id);
      await time.increase(VOTE + 1);
      await ds.finalizeVote(id);
    }
    expect(await ds.status(id)).to.equal(4); // Completed
    expect(await ethers.provider.getBalance(await ds.getAddress())).to.equal(0n);
    expect(await ds.hasVoted(id, a.address)).to.equal(false);
  });

  it("creator can cancel; donors can cancel an abandoned funded campaign", async () => {
    const id1 = await create();
    await ds.connect(a).donate(id1, "", { value: E("1") });
    await expect(ds.connect(a).cancel(id1)).to.be.revertedWithCustomError(ds, "NotCreator");
    await ds.connect(creator).cancel(id1);
    await expect(ds.connect(a).claimRefund(id1)).to.changeEtherBalance(a, E("1"));

    const id2 = await create();
    await ds.connect(a).donate(id2, "", { value: E("3") });
    await expect(ds.connect(a).cancelForInactivity(id2)).to.be.revertedWithCustomError(ds, "NotAllowed");
    await time.increase(IDLE + 1);
    await expect(ds.connect(c).cancelForInactivity(id2)).to.be.revertedWithCustomError(ds, "NotAllowed");
    await ds.connect(a).cancelForInactivity(id2);
    expect(await ds.refundableOf(id2, a.address)).to.equal(E("3"));
  });

  it("creator updates are public and creator-only", async () => {
    const id = await create();
    await ds.connect(creator).postUpdate(id, "Borewell site surveyed");
    await expect(ds.connect(a).postUpdate(id, "spam")).to.be.revertedWithCustomError(ds, "NotCreator");
    const ups = await ds.getUpdates(id);
    expect(ups.length).to.equal(1);
    expect(ups[0].text).to.equal("Borewell site surveyed");
  });
});
