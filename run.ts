
const { join } = require("path")
import { graphql } from "@octokit/graphql"
import * as playwright from 'playwright'
import { existsSync } from "fs"
import { execSync } from "child_process"

(async () => {

  const response: any = await graphql(
    `
    query { 
      viewer { 
        login
        pullRequests(last: 5) {
          nodes {
            repository {
              name
              owner {
                avatarUrl
                login
              }
            }
            state
            title
            bodyHTML
          }
        }
      }
    }
    `,
    {
      headers: {
        authorization: `token ${process.env.GITHUB_API_TOKEN}`,
      },
    }
  );
  console.log(`Got PRs for ${response.viewer.login}`)
  const prs = response.viewer.pullRequests.nodes
  
  const browser = await playwright["chromium"].launch()
    for (const pr of prs) {
      const i = prs.indexOf(pr)
      const context = await browser.newContext()
      const page = await context.newPage()
    
      const url = `file:${join(__dirname, 'web', 'index.html')}`
      await page.goto(url);
    
      const JS = `
      document.getElementById("org-icon").src = '${pr.repository.owner.avatarUrl}'
      document.getElementById("repo-name").innerText = '${pr.repository.owner.login}/${pr.repository.name}'
      document.getElementById("pr-name").innerText = \`${pr.title.replace(/`/g, "'")}\`
      document.getElementById("pr-body").innerHTML = \`${pr.bodyHTML.replace(/`/g, "'")}\`
      document.getElementById("status").style.display = \`${pr.state === "MERGED" ? "block" : "none"}\`

      setIndex(${i}, ${prs.length})
      `
      try {
        await page.evaluate(JS);
        await page.screenshot({ path: `./images/${i}.png`, clip: { x: 0, y: 0, width: 378, height: 100 } });
      } catch (error) {
        console.error(error)
        console.log(JS)
        await browser.close()
      }
    }

  console.log("made screenshots")
  await browser.close();
  const gistToken = "032161472173202c27337763fe1d9d56"

  if (!existsSync(gistToken)) {
    execSync(`mkdir ${gistToken}`)
  }

  const Gm = require("gm")
  Gm()
  .in("images/*.png")
  .delay(400)
  .resize(378, 100)
  .write(`${gistToken}/main.gif`, async function(err){
    if (err) throw err;
    console.log("main.gif created")

    console.log("done")
  })
})();

