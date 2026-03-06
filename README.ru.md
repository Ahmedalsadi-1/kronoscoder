<p align="center">
  <a href="https://kronoscode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="KronosCode logo">
    </picture>
  </a>
</p>
<p align="center">Открытый AI-агент для программирования.</p>
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

### Установка

```bash
# YOLO
curl -fsSL https://kronoscode.ai/install | bash

# Менеджеры пакетов
npm i -g kronoscode-ai@latest        # или bun/pnpm/yarn
scoop install kronoscode             # Windows
choco install kronoscode             # Windows
brew install anomalyco/tap/kronoscode # macOS и Linux (рекомендуем, всегда актуально)
brew install kronoscode              # macOS и Linux (официальная формула brew, обновляется реже)
sudo pacman -S kronoscode            # Arch Linux (Stable)
paru -S kronoscode-bin               # Arch Linux (Latest from AUR)
mise use -g kronoscode               # любая ОС
nix run nixpkgs#kronoscode           # или github:anomalyco/kronoscode для самой свежей ветки dev
```

> [!TIP]
> Перед установкой удалите версии старше 0.1.x.

### Десктопное приложение (BETA)

KronosCode также доступен как десктопное приложение. Скачайте его со [страницы релизов](https://github.com/anomalyco/kronoscode/releases) или с [kronoscode.ai/download](https://kronoscode.ai/download).

| Платформа             | Загрузка                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `kronoscode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `kronoscode-desktop-darwin-x64.dmg`     |
| Windows               | `kronoscode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` или AppImage           |

```bash
# macOS (Homebrew)
brew install --cask kronoscode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/kronoscode-desktop
```

#### Каталог установки

Скрипт установки выбирает путь установки в следующем порядке приоритета:

1. `$KRONOSCODE_INSTALL_DIR` - Пользовательский каталог установки
2. `$XDG_BIN_DIR` - Путь, совместимый со спецификацией XDG Base Directory
3. `$HOME/bin` - Стандартный каталог пользовательских бинарников (если существует или можно создать)
4. `$HOME/.kronoscode/bin` - Fallback по умолчанию

```bash
# Примеры
KRONOSCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://kronoscode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://kronoscode.ai/install | bash
```

### Agents

В KronosCode есть два встроенных агента, между которыми можно переключаться клавишей `Tab`.

- **build** - По умолчанию, агент с полным доступом для разработки
- **plan** - Агент только для чтения для анализа и изучения кода
  - По умолчанию запрещает редактирование файлов
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеален для изучения незнакомых кодовых баз или планирования изменений

Также включен сабагент **general** для сложных поисков и многошаговых задач.
Он используется внутренне и может быть вызван в сообщениях через `@general`.

Подробнее об [agents](https://kronoscode.ai/docs/agents).

### Документация

Больше информации о том, как настроить KronosCode: [**наши docs**](https://kronoscode.ai/docs).

### Вклад

Если вы хотите внести вклад в KronosCode, прочитайте [contributing docs](./CONTRIBUTING.md) перед тем, как отправлять pull request.

### Разработка на базе KronosCode

Если вы делаете проект, связанный с KronosCode, и используете "kronoscode" как часть имени (например, "kronoscode-dashboard" или "kronoscode-mobile"), добавьте примечание в README, чтобы уточнить, что проект не создан командой KronosCode и не аффилирован с нами.

### FAQ

#### Чем это отличается от Claude Code?

По возможностям это очень похоже на Claude Code. Вот ключевые отличия:

- 100% open source
- Не привязано к одному провайдеру. Мы рекомендуем модели из [KronosCode Zen](https://opencode.ai/zen); но KronosCode можно использовать с Claude, OpenAI, Google или даже локальными моделями. По мере развития моделей разрыв будет сокращаться, а цены падать, поэтому важна независимость от провайдера.
- Поддержка LSP из коробки
- Фокус на TUI. KronosCode построен пользователями neovim и создателями [terminal.shop](https://terminal.shop); мы будем раздвигать границы того, что возможно в терминале.
- Архитектура клиент/сервер. Например, это позволяет запускать KronosCode на вашем компьютере, а управлять им удаленно из мобильного приложения. Это значит, что TUI-фронтенд - лишь один из возможных клиентов.

---

**Присоединяйтесь к нашему сообществу** [Discord](https://discord.gg/kronoscode) | [X.com](https://x.com/kronoscode)
