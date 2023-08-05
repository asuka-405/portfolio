import FS from "fs"
import { minify } from "minify"
import PATH from "path"

const MINIFY_OPTIONS = {
  html: {
    removeComments: true,
    collapseWhitespace: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    miniCSS: true,
    miniJS: true,
  },
  js: {
    removeConsole: true,
    removeUnusedVariables: true,
  },
}

const extentions = [".html", ".htm", ".css", ".js"]

function optimize(src, dest) {
  // Check if the source directory exists
  if (!FS.existsSync(src)) {
    console.error(`Source directory "${src}" does not exist.`)
    return
  }

  // Delete the destination directory if it exists
  if (FS.existsSync(dest)) FS.rmSync(dest, { recursive: true })

  // Create the destination directory
  FS.mkdirSync(dest)

  // Function to recursively copy files and directories
  async function recurseToMinify(src, dest) {
    const stats = FS.statSync(src)

    if (stats.isDirectory()) {
      FS.mkdirSync(dest, { recursive: true })
      const files = FS.readdirSync(src)
      files.forEach((file) => {
        recurseToMinify(PATH.join(src, file), PATH.join(dest, file))
      })
    } else {
      const ext = PATH.extname(src)

      if (src.includes("vendor")) FS.copyFileSync(src, dest)
      else if (extentions.includes(ext))
        FS.writeFileSync(dest, await minify(src, MINIFY_OPTIONS), "utf8")
      else FS.copyFileSync(src, dest)
    }
  }

  // Start copying from source to destination
  recurseToMinify(src, dest)
}

// Example usage:
const src = "src"
const dest = "dist"

optimize(src, dest)
