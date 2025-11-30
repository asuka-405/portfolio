export function generateTagCloud() {
  const tagCloudContainer = document.querySelector(".tag-cloud")
  const tags = [
    "JavaScript",
    "TypeScript",
    "React",
    "QwikJS",
    "ExpressJS",
    "ElectronJS",
    "NodeJS",
    "Go",
    "Chi",
    "Java",
    "SprintBoot",
    "ProtoBuf",
    "Linux",
    "Bash",
    "SQL",
    "MongoDB",
    "SailPoint",
    "IGA",
    "n8n"
  ]
  const options = {
    radius: 180, // default 100px
    maxSpeed: "normal", // default normal
    initSpeed: "slow", // default normal
    direction: 135, // default 135deg
    keep: true, // default true
    useHTML: true, // default false
  }
  TagCloud(tagCloudContainer, tags, options)
}
