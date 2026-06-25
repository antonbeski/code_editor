from flask import Flask, render_template, jsonify, request
import json

# Use __name__ so Flask can locate the templates/static folders correctly.
app = Flask(__name__)
# Application display name
app.name = "run01"

@app.route("/")
def index():
    return render_template("index.html")

# ── Yahoo Finance server-side proxy ───────────────────────────────────────────
@app.route("/api/yf/<ticker>")
def yf_proxy(ticker):
    try:
        import yfinance as yf
        period   = request.args.get("period",   "1mo")
        interval = request.args.get("interval", "1d")

        t    = yf.Ticker(ticker.upper())
        hist = t.history(period=period, interval=interval)

        if hist.empty:
            return jsonify({"error": f"No price data found for '{ticker}'."}), 404

        hist.index = hist.index.strftime("%Y-%m-%d")
        records = hist.reset_index().rename(columns={"index": "Date"}).to_dict(orient="records")
        return jsonify(records)

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

# ── Piston code execution proxy (C++, C#, Rust) ──────────────────────────────
# Routes compilation requests to the Piston API (https://emkc.org) which runs
# code server-side. This avoids needing to install gcc/mono/rustc locally and
# works perfectly on Vercel serverless.
PISTON_URL = "https://emkc.org/api/v2/piston/execute"
PISTON_LANGS = {
    "cpp":    "c++",
    "csharp": "csharp",
    "rust":   "rust",
}

@app.route("/api/run", methods=["POST"])
def run_code():
    try:
        from urllib.request import Request, urlopen

        data = request.get_json(force=True)
        lang_key = data.get("language", "")
        piston_lang = PISTON_LANGS.get(lang_key)

        if not piston_lang:
            return jsonify({"error": f"Unsupported language: {lang_key}"}), 400

        payload = json.dumps({
            "language": piston_lang,
            "version": "*",
            "files": [{"content": data.get("code", "")}],
        }).encode("utf-8")

        req = Request(
            PISTON_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        return jsonify(result)

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

if __name__ == "__main__":
    app.run(debug=True)
