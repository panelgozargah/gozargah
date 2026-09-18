import asyncio, pathlib
from playwright.async_api import async_playwright

DOCS = pathlib.Path('/home/z/my-project/gozargah/docs')
OUT = pathlib.Path('/home/z/my-project/qa_landing'); OUT.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        await pg.goto(DOCS.joinpath('index.html').as_uri())
        await pg.wait_for_timeout(2500)
        # force all reveals on (scroll through)
        h = await pg.evaluate('document.body.scrollHeight')
        for y in range(0, h, 700):
            await pg.evaluate(f'window.scrollTo(0,{y})')
            await pg.wait_for_timeout(120)
        await pg.evaluate('window.scrollTo(0,0)')
        await pg.wait_for_timeout(900)
        await pg.add_style_tag(content='.rv{opacity:1!important;transform:none!important} .hero .banner{animation:none!important}')
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT/'landing_full.png'), full_page=True)
        # mobile
        pm = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        await pm.goto(DOCS.joinpath('index.html').as_uri())
        await pm.wait_for_timeout(2000)
        hm = await pm.evaluate('document.body.scrollHeight')
        for y in range(0, hm, 600):
            await pm.evaluate(f'window.scrollTo(0,{y})')
            await pm.wait_for_timeout(90)
        await pm.evaluate('window.scrollTo(0,0)')
        await pm.wait_for_timeout(700)
        await pm.screenshot(path=str(OUT/'landing_mobile.png'), full_page=True)
        await b.close()
        print('OK', h, 'x', hm)

asyncio.run(main())
