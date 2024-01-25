import { getCurrentArticleHtml } from "/article/javascript/editor/helpers.js"

export async function publishArticle(uname, token, repo) {
    const contents = getCurrentArticleHtml()
    console.log(contents)
    const title = RegExp(/<title>(.*)<\/title>/).exec(contents)[1]

    const filename = title.toLowerCase().replace(/ /g, "_")

    uploadToGithub(uname, token, repo, `article/${filename}.html`, contents)
        .then(() => {
            const body = document.querySelector("body").innerHTML
            document.body.innerHTML = `<span class="loader"></span>`
            setTimeout(() => {
                updateArchive(title, uname, token, repo)
                document.body.innerHTML = body
                document.querySelector("dialog").close()
            }, 5000)
        })
        .catch((e) => {
            console.error(e)
            alert("Error publishing article")
        })
}

export function updateArchive(title, uname, token, repo) {
    fetch(
        `https://api.github.com/repos/${uname}/${repo}/contents/article/index.html`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
            },
        }
    )
        .then((data) => data.json())
        .then((json) => {
            const content = atob(json.content)
            const dom = new DOMParser().parseFromString(content, "text/html")
            const newContent = addArticle(dom, title)
            updateRepo(uname, token, repo, newContent, json.sha)
        })
}

function addArticle(dom, title) {
    const article = dom.createElement("div")
    article.classList.add("article")
    article.innerHTML = `
        <a href="/article/${title}/">
            <h3>${title}</h3>
        </a>
    `
    dom.querySelector(".article-list").insertBefore(
        article,
        dom.querySelector(".article-list").firstChild
    )
    return new XMLSerializer().serializeToString(dom)
}

function updateRepo(uname, token, repo, content, sha) {
    uploadToGithub(uname, token, repo, "article/index.html", content, sha)
}

async function uploadToGithub(uname, token, repo, filePath, content, sha) {
    const url = `https://api.github.com/repos/${uname}/${repo}/contents/${filePath}`

    content = btoa(content)

    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    xhr.setRequestHeader("Authorization", `token ${token}`)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json")
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            alert(
                `Article published @ https://suryansh405.netlify.app/${filePath}`
            )
            console.log(JSON.parse(xhr.responseText))
        } else {
            alert(`Error ${xhr.status}: ${xhr.responseText}`)
            console.log(JSON.parse(xhr.response))
        }
    }
    const data = {
        message: "Article published",
        content,
        branch: "Main",
    }
    if (sha) data.sha = sha
    xhr.send(JSON.stringify(data))
}
