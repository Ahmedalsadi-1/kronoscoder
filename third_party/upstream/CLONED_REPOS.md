# Cloned Upstream Repositories

Generated: 2026-03-13T03:28:00-05:00
Location: `third_party/upstream`

| Name | URL | Branch | Pinned SHA | Cloned At |
|---|---|---|---|---|
| jaaz | https://github.com/11cafe/jaaz.git | main | `145dd85067be77e36d400637a595e19a7b07c77a` | 2026-03-13 |
| nocobase | https://github.com/nocobase/nocobase.git | main | `e90f164ad9be598a553ff46604fde68331ba33d7` | 2026-03-13 |
| excalidraw-mcp | https://github.com/excalidraw/excalidraw-mcp.git | main | `542091bff3517f965b67b77dd5af5566817f682d` | 2026-03-13 |
| atsurae | https://github.com/1000ri-jp/atsurae.git | main | `e810c07416d183e015280b2947b03c2c5c5e953d` | 2026-03-13 |
| personalizationmcp | https://github.com/YangLiangwei/PersonalizationMCP.git | main | `f491a4c9db855a6f2f086067717cdba1764feeb0` | 2026-03-13 |

## Verification

Run:

```bash
cd third_party/upstream
for d in jaaz nocobase excalidraw-mcp atsurae personalizationmcp; do
  git -C "$d" rev-parse --abbrev-ref HEAD
  git -C "$d" rev-parse HEAD
done
```
