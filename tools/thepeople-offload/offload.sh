#!/usr/bin/env bash
# CityLive v2.0 "THE PEOPLE" — offload a data-gen job to the GameServer LiteLLM.
# Usage: offload.sh <model> <prompt-file> <out-json>   (prompt must instruct pure-JSON output)
set -euo pipefail
MODEL="${1:?model}"; PF="${2:?prompt file}"; OUT="${3:?out}"
KEY="$(grep -oP 'api_key:\s*\K\S+' "$HOME/.hermes/config.yaml" | head -1)"
PROMPT="$(cat "$PF")"
BODY="$(python3 - "$MODEL" "$PROMPT" <<'PY'
import json,sys
model,prompt=sys.argv[1],sys.argv[2]
print(json.dumps({"model":model,"temperature":0.7,"max_tokens":8000,
 "messages":[{"role":"system","content":"You are a precise data generator. Output ONLY valid JSON, no prose, no markdown fences."},
             {"role":"user","content":prompt}]}))
PY
)"
echo "[offload] $MODEL -> $OUT ..." >&2
curl -s -m 600 http://192.168.4.26:4000/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" > "$OUT.raw"
# strip any accidental fences, keep the JSON object/array
python3 - "$OUT.raw" "$OUT" <<'PY'
import sys,re,json
raw=open(sys.argv[1]).read().strip()
raw=re.sub(r'^```[a-zA-Z]*','',raw).strip().strip('`').strip()
m=re.search(r'(\{.*\}|\[.*\])',raw,re.S)
s=m.group(1) if m else raw
obj=json.loads(s)  # will throw if invalid -> visible failure
json.dump(obj, open(sys.argv[2],'w'), indent=2)
print("[offload] wrote %s (%d bytes valid JSON)"%(sys.argv[2],len(json.dumps(obj))), file=sys.stderr)
PY
