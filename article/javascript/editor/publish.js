import { getCurrentArticleHtml } from "/article/javascript/editor/helpers.js"

const dialog = document.querySelector("dialog")

dialog.addEventListener("close", () => {
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

export function publishArticle(uname, token, repo) {
    const contents = getCurrentArticleHtml()

    console.log(contents)

    const isTrue = true
    if (isTrue) return

    const base64EncodedContents = btoa(contents)
    const title = RegExp(/<title>(.*)<\/title>/).exec(contents)[1]

    const url = `https://api.github.com/repos/${uname}/${repo}/contents/article/${title}.html`

    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    xhr.setRequestHeader("Authorization", `token ${token}`)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json")
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            alert(
                `Article published @ https://suryansh405.netlify.app/article/${title}.html`
            )
        } else {
            alert(`Error ${xhr.status}: ${xhr.statusText}`)
        }
    }
    const data = {
        message: "Article published",
        content: base64EncodedContents,
        branch: "Main",
    }
    xhr.send(JSON.stringify(data))
}

// export async function publishArticle() {
//   let content = extractContent()
//   console.log(content)
//   const images = content.filter((item) => item.type === "image")
//   content = content.filter(async (item) => {
//     if (item.type === "image") {
//       item.content = await getHashFromString(item.content)
//     }
//   })
//   const formData = new FormData()
//   formData.append("content", JSON.stringify(content))
//   images.forEach((image) => {
//     formData.append("images", image.content)
//   })
//   const response = await fetch("http://localhost:3000/publish", {
//     method: "POST",
//     body: formData,
//   })
//   const result = await response.text()
//   console.log(result)
// }

// async function getHashFromString(str) {
//   const hashBuffer = await crypto.subtle.digest(
//     "SHA-256",
//     new TextEncoder().encode(str)
//   )
//   const hashArray = Array.from(new Uint8Array(hashBuffer))
//   const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
//   return hashHex
// }

// function extractContent() {
//   const article = document.querySelector(".article")
//   const title = article.querySelector(".title")
//   const items = article.querySelectorAll(".article-item")
//   const contentList = []
//   contentList.push({
//     type: "title",
//     content: title.innerText,
//   })
//   items.forEach((item) => {
//     let content
//     const contentNode = item.querySelector(".content")
//     const type = item.classList[0]
//     if (type === "text" || type === "heading") content = contentNode.innerText
//     else if (type === "image") content = contentNode.src
//     contentList.push({
//       type: item.classList[0],
//       content,
//     })
//   })
//   return contentList
// }
