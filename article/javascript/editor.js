import {
    newHeading,
    newImage,
    newText,
} from "/article/javascript/editor/utils.js"

const editor = document.querySelector(".editor")
const newItemBar = document.querySelector(".new-item")
const togglePreview = document.querySelector("#toggle-preview")

document.querySelector(".article > .title").contentEditable = true
newHeading()

document.querySelector(".toggle").addEventListener("click", () => {
    togglePreview.checked
        ? editor.classList.remove("editor")
        : editor.classList.add("editor")
    document.querySelectorAll(".delete").forEach((button) => {
        if (togglePreview.checked) button.style.display = "none"
        else button.style.display = "block"
    })
})

newItemBar.querySelectorAll(".option").forEach((option) => {
    option.addEventListener("click", () => {
        if (option.classList.contains("heading"))
            editor.appendChild(newHeading())
        else if (option.classList.contains("text"))
            editor.appendChild(newText())
        else if (option.classList.contains("image"))
            editor.appendChild(newImage())
    })
})

document.querySelector(".publish").addEventListener("click", () => {
    document.querySelector("dialog").showModal()
})
