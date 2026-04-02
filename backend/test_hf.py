import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://huggingface.co/api/models?search=medgemma', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode('utf-8'))
        for item in data[:5]:
            print(f"Model ID: {item['id']}")
except Exception as e:
    print(f"Error: {e}")
