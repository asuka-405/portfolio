import { newItem, setImage } from "./helpers.js"

export function newHeading() {
  return newItem("h1", "Heading!!", undefined, { classList: ["heading"] })
}
export function newText() {
  return newItem("p", "Paragraph!!", undefined, { classList: ["text"] })
}

export function newImage() {
  const image = newItem(
    "img",
    undefined,
    {
      src: "",
    },
    {
      classList: ["image"],
    }
  )
  image.addEventListener("click", () => {
    image.classList.toggle("expanded-image")
  })
  setImage(image)
  return image
}
