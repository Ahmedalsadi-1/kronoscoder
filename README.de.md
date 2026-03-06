<p align="center">
  <a href="https://kronoscode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="KronosCode logo">
    </picture>
  </a>
</p>
<p align="center">Der Open-Source KI-Coding-Agent.</p>
<p align="center">
  <a href="https://kronoscode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/kronoscode-ai"><img alt="npm" src="https://img.shields.io/npm/v/kronoscode-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/kronoscode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/kronoscode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a>
</p>

[![KronosCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://kronoscode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://kronoscode.ai/install | bash

# Paketmanager
npm i -g kronoscode-ai@latest        # oder bun/pnpm/yarn
scoop install kronoscode             # Windows
choco install kronoscode             # Windows
brew install anomalyco/tap/kronoscode # macOS und Linux (empfohlen, immer aktuell)
brew install kronoscode              # macOS und Linux (offizielle Brew-Formula, seltener aktualisiert)
sudo pacman -S kronoscode            # Arch Linux (Stable)
paru -S kronoscode-bin               # Arch Linux (Latest from AUR)
mise use -g kronoscode               # jedes Betriebssystem
nix run nixpkgs#kronoscode           # oder github:anomalyco/kronoscode für den neuesten dev-Branch
```

> [!TIP]
> Entferne Versionen älter als 0.1.x vor der Installation.

### Desktop-App (BETA)

KronosCode ist auch als Desktop-Anwendung verfügbar. Lade sie direkt von der [Releases-Seite](https://github.com/anomalyco/kronoscode/releases) oder [kronoscode.ai/download](https://kronoscode.ai/download) herunter.

| Plattform             | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `kronoscode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `kronoscode-desktop-darwin-x64.dmg`     |
| Windows               | `kronoscode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` oder AppImage          |

```bash
# macOS (Homebrew)
brew install --cask kronoscode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/kronoscode-desktop
```

#### Installationsverzeichnis

Das Installationsskript beachtet die folgende Prioritätsreihenfolge für den Installationspfad:

1. `$KRONOSCODE_INSTALL_DIR` - Benutzerdefiniertes Installationsverzeichnis
2. `$XDG_BIN_DIR` - XDG Base Directory Specification-konformer Pfad
3. `$HOME/bin` - Standard-Binärverzeichnis des Users (falls vorhanden oder erstellbar)
4. `$HOME/.kronoscode/bin` - Standard-Fallback

```bash
# Beispiele
KRONOSCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://kronoscode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://kronoscode.ai/install | bash
```

### Agents

KronosCode enthält zwei eingebaute Agents, zwischen denen du mit der `Tab`-Taste wechseln kannst.

- **build** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **plan** - Nur-Lese-Agent für Analyse und Code-Exploration
  - Verweigert Datei-Edits standardmäßig
  - Fragt vor dem Ausführen von bash-Befehlen nach
  - Ideal zum Erkunden unbekannter Codebases oder zum Planen von Änderungen

Außerdem ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben enthalten.
Dieser wird intern genutzt und kann in Nachrichten mit `@general` aufgerufen werden.

Mehr dazu unter [Agents](https://kronoscode.ai/docs/agents).

### Dokumentation

Mehr Infos zur Konfiguration von KronosCode findest du in unseren [**Docs**](https://kronoscode.ai/docs).

### Beitragen

Wenn du zu KronosCode beitragen möchtest, lies bitte unsere [Contributing Docs](./CONTRIBUTING.md), bevor du einen Pull Request einreichst.

### Auf KronosCode aufbauen

Wenn du an einem Projekt arbeitest, das mit KronosCode zusammenhängt und "kronoscode" als Teil seines Namens verwendet (z.B. "kronoscode-dashboard" oder "kronoscode-mobile"), füge bitte einen Hinweis in deine README ein, dass es nicht vom KronosCode-Team gebaut wird und nicht in irgendeiner Weise mit uns verbunden ist.

### FAQ

#### Worin unterscheidet sich das von Claude Code?

In Bezug auf die Fähigkeiten ist es Claude Code sehr ähnlich. Hier sind die wichtigsten Unterschiede:

- 100% open source
- Nicht an einen Anbieter gekoppelt. Wir empfehlen die Modelle aus [KronosCode Zen](https://opencode.ai/zen); KronosCode kann aber auch mit Claude, OpenAI, Google oder sogar lokalen Modellen genutzt werden. Mit der Weiterentwicklung der Modelle werden die Unterschiede kleiner und die Preise sinken, deshalb ist Provider-Unabhängigkeit wichtig.
- LSP-Unterstützung direkt nach dem Start
- Fokus auf TUI. KronosCode wird von Neovim-Nutzern und den Machern von [terminal.shop](https://terminal.shop) gebaut; wir treiben die Grenzen dessen, was im Terminal möglich ist.
- Client/Server-Architektur. Das ermöglicht z.B., KronosCode auf deinem Computer laufen zu lassen, während du es von einer mobilen App aus fernsteuerst. Das TUI-Frontend ist nur einer der möglichen Clients.

---

**Tritt unserer Community bei** [Discord](https://discord.gg/kronoscode) | [X.com](https://x.com/kronoscode)
