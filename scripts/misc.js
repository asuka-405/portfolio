export function generateTagCloud() {
  const tagCloudContainer = document.querySelector(".tag-cloud")
  const tags = [
    "JavaScript",
    "ReactJS",
    "Linux",
    "Bash",
    "NodeJS",
    "Rust",
    "Docker",
    "Nginx",
    "MongoDB",
    "ExpressJS",
    "TypeScript",
    "Java",
    "ElectronJS",
    "HTML",
    "CSS",
    "SASS",
    "Git",
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
