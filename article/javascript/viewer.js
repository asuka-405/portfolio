document
    .querySelector(".article")
    .querySelectorAll("img")
    .forEach((image) => {
        image.addEventListener("click", () => {
            image.classList.toggle("expanded-image")
        })
    })
