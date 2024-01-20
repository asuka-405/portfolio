import { newItem, setImage } from "/article/javascript/editor/helpers.js"

export function newHeading() {
    return newItem("h1", "Heading!!", undefined, { classList: ["heading"] })
}
export function newText() {
    return newItem("p", "Paragraph!!", undefined, { classList: ["text"] })
}

export function newCodeSnippet() {
    const codeSnippet = document.createElement("pre")
    codeSnippet.contentEditable = true
    codeSnippet.classList.add("language-javascript")
    codeSnippet.appendChild(document.createElement("code"))

    const codeSnippetContainer = newItem("div", undefined, undefined, {
        classList: ["code"],
    })
    codeSnippetContainer.appendChild(codeSnippet)
    return codeSnippetContainer
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
