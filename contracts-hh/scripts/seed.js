// Adds a few sample campaigns (and donations, on the local chain) so the UI isn't empty.
//   npx hardhat run scripts/seed.js --network localhost
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const E = (v) => hre.ethers.parseEther(v);
const DAY = 24 * 3600;

const samples = [
  {
    title: "Solar lamps for 40 homes in Chhota Udaipur",
    story:
      "Families in the tribal hamlets near Kawant still study and cook by kerosene light. We will buy and install 40 solar home-lighting kits, and train two local youths to maintain them.\n\nEvery kit is logged with a photo and the family's consent, posted here as an update.",
    category: "Environment",
    image: "",
    days: 30,
    ms: [["Buy first 20 kits", "0.6"], ["Buy remaining 20 kits", "0.6"], ["Training + 6-month spares", "0.3"]],
  },
  {
    title: "Notebooks & bags for Std 1-5, Navapura school",
    story:
      "A government primary school of 180 children where most start the year without a single notebook. We'll supply a full year's kit per child, purchased from a local stationer with bills uploaded as updates.",
    category: "Education",
    image: "",
    days: 21,
    ms: [["Term 1 kits", "0.4"], ["Term 2 kits", "0.4"]],
  },
  {
    title: "Monsoon medical camp, Narmada riverside villages",
    story:
      "Two-day free health camp after monsoon flooding: general check-ups, malaria and dengue testing, and a week of basic medicines for each patient. Doctors volunteer; funds cover tests, medicines and transport.",
    category: "Health",
    image: "",
    days: 14,
    ms: [["Test kits & medicines", "0.5"], ["Transport & camp setup", "0.25"]],
  },
  {
    title: "Fodder bank for stray cattle during summer",
    story:
      "Every May dozens of abandoned cattle collapse near the highway. A volunteer group will run a fodder and water point for 60 days.",
    category: "Animal Welfare",
    image: "",
    days: 45,
    ms: [["First 30 days of fodder", "0.35"], ["Remaining 30 days", "0.35"]],
  },
];

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const depFile = path.join(__dirname, "..", "..", "web", "src", "contracts", "deployments.json");
  const dep = JSON.parse(fs.readFileSync(depFile, "utf8"))[chainId.toString()];
  if (!dep) throw new Error(`No deployment for chain ${chainId}. Run deploy.js first.`);
  const signers = await hre.ethers.getSigners();
  const ds = await hre.ethers.getContractAt("DaanSetu", dep.address);
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const local = chainId === 31337n;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const creator = signers[local ? i % 2 : 0];
    const tx = await ds
      .connect(creator)
      .createCampaign(s.title, s.story, s.category, s.image, now + s.days * DAY, s.ms.map((m) => m[0]), s.ms.map((m) => E(m[1])));
    await tx.wait();
    console.log("created:", s.title);
  }

  if (local) {
    const notes = ["Jai Hind 🙏", "For the kids", "", "Keep it up!", "From Vadodara"];
    const plan = [
      [0, 3, "0.4"], [0, 4, "0.25"], [0, 5, "0.15"],
      [1, 3, "0.8"],
      [2, 4, "0.1"], [2, 6, "0.05"],
    ];
    for (const [id, who, amt] of plan) {
      await (await ds.connect(signers[who]).donate(id, notes[who % notes.length], { value: E(amt) })).wait();
    }
    await (await ds.connect(signers[1]).postUpdate(1, "Quotation received from Shree Stationers, Bodeli. Bills will be posted after purchase.")).wait();
    await (await ds.connect(signers[1]).requestRelease(1)).wait();
    console.log("added sample donations, an update and an open vote");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
