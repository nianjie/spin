
import { join } from "path"
import { graphql } from "@octokit/graphql"
import * as playwright from 'playwright'
import { existsSync } from "fs"
import { execSync } from "child_process"
import * as gm from "gm"
import { exit } from "process"

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
      document.getElementById("pr-name").innerText = '${pr.title.replace(/`/g, "'")}'
      document.getElementById("pr-body").innerHTML = '${pr.bodyHTML.replace(/`/g, "'")}'
      document.getElementById("status").style.display = '${pr.state === "MERGED" ? "block" : "none"}'

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

  const gistToken = process.env.gist
  if (!gistToken) {
    console.error('error::Environment var[gist] is not setup.')
    exit(1)
  }

  if (existsSync(gistToken)) {
    execSync(`rm -rf ${gistToken}`)
  }
  execSync(`git clone https://${response.viewer.login}:${process.env.GITHUB_API_TOKEN}@gist.github.com/${gistToken}.git`)

  gm("images/*.png")
  .delay(200)
  .resize(378, 100)
  .write(`${gistToken}/main.gif`, async function(err){
    if (err) throw err;
    console.log("main.gif created")
    execSync(`git add .`, { cwd: gistToken })
    execSync(`git commit -m 'update'`, { cwd: gistToken })
    execSync(`git push`, { cwd: gistToken })
    console.log("done")
  })
})();
