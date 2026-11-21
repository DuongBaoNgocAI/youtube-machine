// Gọi một công cụ Flow AIC qua cổng điều khiển cục bộ. Hợp với bảng cảnh lớn, khỏi dán 100 KB prompt vào lệnh gọi.
// Dùng: node tools/flow/flow_rpc.mjs <tên công cụ> <file JSON tham số>
import fs from "fs";
import os from "os";
import path from "path";
const ctl = JSON.parse(fs.readFileSync(path.join(os.homedir(), "FlowStudio/control.json"), "utf8"));
const [ten, file] = process.argv.slice(2);
const args = JSON.parse(fs.readFileSync(file, "utf8"));
const r = await fetch(`http://127.0.0.1:${ctl.port}/rpc`, {
  method: "POST",
  headers: { Authorization: "Bearer " + ctl.token, "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: ten, arguments: args } }),
  signal: AbortSignal.timeout(300000),
});
console.log(JSON.stringify(await r.json()).slice(0, 3000));
