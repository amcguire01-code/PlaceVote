"""Click through the page like a resident and take screenshots."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
url = (Path(__file__).parent.parent / "dist/index.html").resolve().as_uri()
out = Path(__file__).parent.parent / "shots"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for name, w, h, scheme in [("desk", 1280, 900, "light"), ("phone", 390, 844, "dark")]:
        pg = b.new_page(viewport={"width": w, "height": h}, color_scheme=scheme)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
        pg.goto(url); pg.wait_for_timeout(800)
        pg.screenshot(path=str(out / f"{name}-1-ideas.png"), full_page=True)
        pg.click("[data-pick='1']"); pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f"{name}-2-pin.png"), full_page=True)
        # add an idea: merge case
        pg.click("[data-act='close']"); pg.click("[data-act='add']")
        pg.wait_for_timeout(600); box = pg.locator("#map").bounding_box()
        pg.mouse.click(box["x"] + box["width"] * 0.60, box["y"] + box["height"] * 0.45)
        pg.fill("#idea", "The canal path is so dark at night, it needs proper lights")
        pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
        print(name, "merge:", pg.locator(".card h3").first.inner_text())
        # add an idea: new statement case
        pg.click("[data-act='add']"); pg.wait_for_timeout(600); box = pg.locator("#map").bounding_box()
        pg.mouse.click(box["x"] + box["width"] * 0.30, box["y"] + box["height"] * 0.85)
        pg.fill("#idea", "More bins and a weekly litter pick by the bus stops")
        pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
        print(name, "new:", pg.locator(".card h3").first.inner_text())
        pg.screenshot(path=str(out / f"{name}-3-outcome.png"), full_page=True)
        # draw a route
        pg.click("[data-act='add']"); pg.click("[data-mode='line']"); pg.wait_for_timeout(600)
        box = pg.locator("#map").bounding_box()
        for fx, fy in [(0.45, 0.92), (0.45, 0.62), (0.62, 0.42), (0.72, 0.15)]:
            pg.mouse.click(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy)
        pg.screenshot(path=str(out / f"{name}-3b-drawing.png"), full_page=False)
        pg.click("#legend [data-act='done']")
        pg.fill("#idea", "safe bike route up to the train station")
        pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
        print(name, "route:", pg.locator(".card h3").first.inner_text())
        # draw an area
        pg.click("[data-act='add']"); pg.click("[data-mode='area']"); pg.wait_for_timeout(600)
        box = pg.locator("#map").bounding_box()
        for fx, fy in [(0.86, 0.75), (0.97, 0.75), (0.97, 0.95), (0.86, 0.95)]:
            pg.mouse.click(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy)
        pg.click("#legend [data-act='done']")
        pg.fill("#idea", "Turn part of the retail park car park into a pump track for teenagers")
        pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
        print(name, "area:", pg.locator(".card h3").first.inner_text())
        # whole-area idea
        pg.click("[data-act='add']"); pg.click("[data-mode='wide']")
        pg.fill("#idea", "The board should publish its decisions and budget online")
        pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
        print(name, "wide:", pg.locator(".card h3").first.inner_text())
        pg.screenshot(path=str(out / f"{name}-3c-shapes.png"), full_page=True)
        def idea(fx, fy, text):
            pg.click("[data-act='add']"); pg.wait_for_timeout(600)
            bx = pg.locator("#map").bounding_box()
            pg.mouse.click(bx["x"] + bx["width"] * fx, bx["y"] + bx["height"] * fy)
            pg.fill("#idea", text); pg.click("[data-act='submit']"); pg.wait_for_timeout(200)
            return pg.locator(".card h3").first.inner_text()
        print(name, "station toilets:", idea(0.715, 0.16, "we need public toilets at the station"))
        pg.screenshot(path=str(out / f"{name}-3d-toilets.png"), full_page=False)
        print(name, "swing set:", idea(0.432, 0.82, "add a swing set for little kids by the parade"))
        print(name, "homeless:", idea(0.432, 0.81, "get rid of the homeless people at the parade"))
        print(name, "loos:", idea(0.245, 0.64, "put some loos near the playground"))
        pg.click("[data-act='dispute']"); pg.wait_for_timeout(200)
        print(name, "after dispute:", pg.locator(".card h3").first.inner_text())
        pg.click("#tabs [data-tab='officer']"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / f"{name}-8-officer.png"), full_page=True)
        print(name, "officer flags:", pg.locator(".flag").count(), "| held:", pg.locator("#panel section").nth(1).locator("li").count())
        pg.click("#tabs [data-tab='ideas']")
        pg.click("[data-tab='vote']")
        for v in ["1","1","-1","1","1","1","0","-1","1","1","1","0","1","1","1","1","1","1","1","1","1","1","1","1","1"]:
            if pg.locator(f"[data-vote='{v}']").count(): pg.click(f"[data-vote='{v}']")
        pg.screenshot(path=str(out / f"{name}-4-vote.png"), full_page=True)
        pg.click("#tabs [data-tab='results']"); pg.wait_for_timeout(400)
        pg.screenshot(path=str(out / f"{name}-5-results.png"), full_page=True)
        pg.click("[data-view='1']"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / f"{name}-6-groupB.png"), full_page=False)
        print(name, "you:", pg.locator("#panel section").nth(1).locator("p.small").last.inner_text())
        sw = pg.evaluate("document.documentElement.scrollWidth")
        print(name, "page width", sw, "viewport", w)
        pg.click("[data-tab='how']"); pg.screenshot(path=str(out / f"{name}-7-how.png"), full_page=True)
    b.close()
print("errors:", errors or "none")
