import { chromium } from "playwright"
;(async () => {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  await page.goto("https://advigrow.online")

  // Wait for page to load
  await page.waitForLoadState("networkidle")

  // Look for any form elements
  const forms = await page.$$("form")
  console.log(`Found ${forms.length} forms on the page`)

  if (forms.length > 0) {
    const form = forms[0]

    // Get all input elements in the form
    const inputs = await form.$$("input, textarea, select")
    console.log(`Found ${inputs.length} form elements`)

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const type = (await input.getAttribute("type")) || "text"
      const name = (await input.getAttribute("name")) || ""
      const placeholder = (await input.getAttribute("placeholder")) || ""
      const id = (await input.getAttribute("id")) || ""

      console.log(`Element ${i + 1}: type="${type}" name="${name}" placeholder="${placeholder}" id="${id}"`)

      // Try to fill common form fields
      if (type === "text" || type === "email" || type === "tel") {
        if (name.toLowerCase().includes("name") || placeholder.toLowerCase().includes("name")) {
          await input.fill("Test User")
        } else if (name.toLowerCase().includes("email") || placeholder.toLowerCase().includes("email")) {
          await input.fill("test@example.com")
        } else if (name.toLowerCase().includes("phone") || placeholder.toLowerCase().includes("phone")) {
          await input.fill("123-456-7890")
        } else {
          await input.fill("Test value " + (i + 1))
        }
      } else if (type === "textarea") {
        await input.fill("This is a test message for form filling.")
      } else if (type === "select-one") {
        const options = await input.$$("option")
        if (options.length > 1) {
          await input.selectOption({ index: 1 })
        }
      } else if (type === "checkbox") {
        await input.check()
      } else if (type === "radio") {
        await input.check()
      }
    }

    // Look for submit buttons
    const submitButtons = await form.$('button[type="submit"], input[type="submit"]')
    if (submitButtons) {
      console.log("Found submit button, clicking...")
      await submitButtons.click()
      await page.waitForLoadState("networkidle")
    }
  }

  // Take screenshot after filling form
  await page.screenshot({ path: "advigrow_form_filled.png", fullPage: true })

  console.log("Form filling complete. Screenshot saved.")

  // Wait a bit to see results
  await page.waitForTimeout(3000)

  await browser.close()
})()
