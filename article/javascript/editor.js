import {
    newCodeSnippet,
    newH2,
    newH3,
    newImage,
    newText,
} from "/article/javascript/editor/utils.js"

import { publishArticle } from "/article/javascript/editor/publish.js"

const editor = document.querySelector(".editor")
const newItemBar = document.querySelector(".new-item")
const togglePreview = document.querySelector("#toggle-preview")

document.querySelector(".article > .title").contentEditable = true
// newHeading()

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
        if (option.classList.contains("heading")) {
            if (option.classList.contains("h2")) editor.appendChild(newH2())
            else if (option.classList.contains("h3"))
                editor.appendChild(newH3())
        } else if (option.classList.contains("text"))
            editor.appendChild(newText())
        else if (option.classList.contains("image"))
            editor.appendChild(newImage())
        else if (option.classList.contains("code"))
            editor.appendChild(newCodeSnippet())
    })
})

const dialog = document.querySelector("dialog")

document.querySelector(".publish").addEventListener("click", () => {
    dialog.showModal()
})

dialog.querySelector("#gh-upload").addEventListener("click", () => {
    document.querySelector(".publish").disabled = false

    const uname = dialog.querySelector("#gh-uname").value
    const token = dialog.querySelector("#gh-token").value
    const repo = dialog.querySelector("#gh-repo").value

    if (!uname || !token || !repo) {
        alert("Please fill all the fields")
        return
    }

    publishArticle(uname, token, repo)
})
