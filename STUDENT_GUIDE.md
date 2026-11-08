# Toxic Bar – lokální lab pro studenty (Windows, macOS, Linux)

## Obsah

1. [Co potřebuješ](#1-co-potřebuješ)
2. [Windows – instalace nástrojů](#2-windows--instalace-nástrojů)
3. [macOS – instalace nástrojů](#3-macos--instalace-nástrojů)
4. [Linux – instalace nástrojů](#4-linux--instalace-nástrojů)
5. [Stažení a spuštění Toxic Baru](#5-stažení-a-spuštění-toxic-baru)
6. [Používání a ovládání labu](#6-používání-a-ovládání-labu)
7. [Když něco nefunguje](#7-když-něco-nefunguje)
8. [Důležité informace a ověřená kompatibilita](#8-důležité-informace-a-ověřená-kompatibilita)

**Pro všechny tři operační systémy je vlastní spuštění stejné:**

```text
git clone https://github.com/Invisible-Infra/xpup-toxic-bar.git
cd xpup-cursor-pack
docker compose up -d --build
```

Nejdřív ale musí fungovat Git a Docker. Vyber si podle svého systému
jednu z následujících tří instalačních sekcí.

## 1. Co potřebuješ

- **Git** pro stažení repozitáře.
- **Docker Engine a Docker Compose V2** (příkaz `docker compose`, nikoliv starý `docker-compose`).
- Přístup k internetu při prvním stažení a sestavení image.
- Dostatek volného místa pro sestavení forku a stažení image; doporučujeme
  alespoň **15 GB volného místa** jako rezervu, ne jako ověřené minimum.
- Volné lokální porty **3000** a **3080** (jejich změna je popsána níže).

Na hostitelský systém **nemusíš instalovat Node.js, npm ani Python**.
Nepotřebuješ VPN, Netmaker, WireGuard ani přístup k centrálnímu serveru.

Pokud už máš Git i Docker, přeskoč rovnou na
[stažení a spuštění](#5-stažení-a-spuštění-toxic-baru).

## 2. Windows – instalace nástrojů

Postup je určen pro Windows 11 (x86-64) s Docker Desktop a WSL 2.
Aktuální požadavky a podporované edice Windows najdeš v
[oficiálním návodu Dockeru](https://docs.docker.com/desktop/setup/install/windows-install/).

1. Otevři **PowerShell** a zkontroluj WSL:

   ```powershell
   wsl --version
   ```

   Pokud WSL není nainstalovaný nebo nemá potřebnou verzi, otevři
   **PowerShell jako správce** (Start → napiš „PowerShell“ →
   **Spustit jako správce**) a spusť:

   ```powershell
   wsl --install
   wsl --update
   ```

   Jestli instalace vyžaduje restart Windows, proveď jej.
   Musí být zapnutá hardwarová virtualizace. Při problémech viz
   [požadavky pro WSL 2](https://docs.docker.com/desktop/features/wsl/).

2. Stáhni [Docker Desktop pro Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
   Spusť instalátor a vyber **WSL 2 backend** (pokud nabízí výběr).
   Po instalaci otevři **Start → Docker Desktop**, potvrď podmínky
   a počkej na stav spuštěného enginu.

3. Nainstaluj [Git pro Windows](https://git-scm.com/downloads/win).
   Výchozí možnosti instalátoru jsou pro tento postup dostačující.

4. Otevři **nové okno PowerShellu** (nikoliv Git Bash; níže uvedené
   příkazy fungují přímo v PowerShellu) a zkontroluj:

   ```powershell
   git --version
   docker --version
   docker compose version
   docker info --format '{{.OSType}}'
   ```

   Poslední příkaz musí vypsat `linux`. Pokud vypíše `windows`,
   přepni Docker Desktop na **Linux containers**. Pokud se nedokáže
   spojit s enginem, ověř, že Docker Desktop skutečně běží.

**Hotovo:** pokračuj na [stažení repozitáře](#5-stažení-a-spuštění-toxic-baru).
WSL Linux distribuci pro práci s tímto labem otevírat nemusíš; vše lze
provést v PowerShellu.

## 3. macOS – instalace nástrojů

Postup platí pro Mac s procesorem Intel i Apple Silicon (M1/M2/M3/M4 a novější),
pokud jejich verzi macOS podporuje Docker Desktop.

1. Otevři **Terminal** (Applications → Utilities → Terminal) a ověř Git:

   ```sh
   git --version
   ```

   Pokud Git chybí, nainstaluj Apple Command Line Tools:

   ```sh
   xcode-select --install
   ```

   Dokonči zobrazený instalátor a pak znovu zkus `git --version`.

2. Na stránce [Docker Desktop pro macOS](https://docs.docker.com/desktop/setup/install/mac-install/)
   vyber správný instalátor pro **Apple Silicon** nebo **Intel**.
   Otevři stažený `Docker.dmg` a přetáhni **Docker** do **Applications**.

3. Otevři **Applications → Docker.app**, dokonči první spuštění a
   počkej na běžící Docker Engine.

4. V Terminálu zkontroluj:

   ```sh
   docker --version
   docker compose version
   docker info --format '{{.OSType}}'
   ```

   Poslední příkaz musí vrátit `linux`.

**Hotovo:** pokračuj na [stažení repozitáře](#5-stažení-a-spuštění-toxic-baru).

## 4. Linux – instalace nástrojů

Použij **Docker Engine a Docker Compose V2** (příkaz `docker compose`).
Není potřeba Docker Desktop. Pokud už máš funkční Git, Docker Engine
a Compose V2, pokračuj rovnou na [spuštění labu](#5-stažení-a-spuštění-toxic-baru).

### Ubuntu a Debian (doporučený postup)

Příkazy spusť v terminálu. Jde o instalaci z **oficiálního repozitáře
Dockeru**, ne o zastaralou samostatnou verzi Compose.

1. Nainstaluj Git a balíčky pro repozitář:

   ```bash
   sudo apt-get update
   sudo apt-get install -y git ca-certificates curl
   sudo install -m 0755 -d /etc/apt/keyrings
   ```

2. Vyber **pouze jeden** z následujících dvou bloků podle distribuce.

   **Ubuntu:**

   ```bash
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
   Types: deb
   URIs: https://download.docker.com/linux/ubuntu
   Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
   Components: stable
   Architectures: $(dpkg --print-architecture)
   Signed-By: /etc/apt/keyrings/docker.asc
   EOF
   ```

   **Debian:**

   ```bash
   sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
   Types: deb
   URIs: https://download.docker.com/linux/debian
   Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
   Components: stable
   Architectures: $(dpkg --print-architecture)
   Signed-By: /etc/apt/keyrings/docker.asc
   EOF
   ```

3. Nainstaluj Docker a Compose:

   ```bash
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo systemctl enable --now docker
   ```

   Pokud už jsi měl nainstalované konfliktní balíčky (např. `docker.io`,
   staré `docker-compose` či `containerd`), nejprve se řiď postupem
   odebrání konfliktů v oficiálním návodu:
   [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) /
   [Debian](https://docs.docker.com/engine/install/debian/).

### Fedora

Pro Fedoru použij oficiální Docker RPM repozitář:

```bash
sudo dnf install -y git
sudo dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Pokud máš konfliktní starší instalaci Dockeru, nejprve postupuj podle
[instalačního návodu pro Fedoru](https://docs.docker.com/engine/install/fedora/).

### Ostatní distribuce (včetně Arch Linuxu)

Postupuj podle dokumentace své distribuce:
[Docker Engine](https://docs.docker.com/engine/install/),
[Docker Compose](https://docs.docker.com/compose/install/linux/);
pro Arch Linux případně [ArchWiki](https://wiki.archlinux.org/title/Docker).

### Oprávnění a kontrola na Linuxu

Ve výchozím nastavení vyžaduje Docker Engine práva správce.
Abys mohl spouštět studentské příkazy **bez `sudo`**, můžeš svůj účet
přidat do skupiny `docker`:

```bash
sudo usermod -aG docker "$USER"
```

**Pak se odhlas a znovu přihlas.** Upozornění: členství ve skupině
`docker` fakticky poskytuje oprávnění srovnatelná s rootem.
Pokud tuto možnost nechceš používat, u všech příkazů začínajících
`docker` v dalším návodu použij `sudo`.

V nově otevřeném terminálu ověř:

```bash
git --version
docker --version
docker compose version
docker info --format '{{.OSType}}'
```

Poslední příkaz má vypsat `linux`; ostatní mají skončit bez chyby.
**Hotovo:** pokračuj na spuštění labu.

## 5. Stažení a spuštění Toxic Baru

**Všechny následující příkazy spouštěj ve stejném terminálu**:
PowerShell na Windows, Terminal na macOS nebo terminál na Linuxu.

1. Vyber složku, kde chceš mít projekt (např. domovský adresář).
   Naklonuj **studentskou větev** privátního repozitáře:

   ```sh
   git clone https://github.com/Invisible-Infra/xpup-toxic-bar.git
   cd xpup-cursor-pack
   ```

   Pokud GitHub požádá o přihlášení, použij svůj GitHub účet s přístupem
   do repozitáře. Pokud běžně používáš SSH klíč, můžeš namísto HTTPS
   použít `git@github.com:Invisible-Infra/xpup-toxic-bar.git`.

2. Zkontroluj, že je konfigurace načtená správně:

   ```sh
   docker compose config --quiet
   ```

   Správně se příkaz ukončí bez chybového hlášení. V kořenovém
   `.env` je nastaveno `COMPOSE_FILE=compose.yaml`; nic nemusíš
   přepínat a **nepoužívej** VPS soubor `docker-compose.yaml`.

3. Spusť sestavení a start:

   ```sh
   docker compose up -d --build
   ```

   První build stáhne image a sestaví aplikaci. Dokončení poznáš
   podle návratu terminálu bez chyby a následné kontroly služeb.
   Varování o chybějícím `buildx` pluginu samo o sobě **nemusí být
   chybou**: na Arch Linuxu byl úspěšně použit starší builder.

4. Ověř kontejnery:

   ```sh
   docker compose ps -a
   ```

   Služby `app`, `mailbox`, `fetch-worker`, `catalog-worker`,
   `fixtures` a `fixture-delay` mají být **Up**.
   `volume-init` má být **Exited (0)** – to je v pořádku,
   jde o jednorázovou inicializaci.

5. Otevři v prohlížeči:

   - **Toxic Bar:** http://127.0.0.1:3000
   - **Cvičná e-mailová schránka pro L2:** http://127.0.0.1:3080

   Přihlašovací účty a hesla jsou v souboru [UCTY.md](UCTY.md).
   Pro rychlou kontrolu lze použít účet `a@lab.test`.

**Nespouštěj** `deploy/scripts/*`, `student/qa/run.sh` ani
`instructor-role` – to nejsou kroky studentské instalace.

## 6. Používání a ovládání labu

Příkazy spouštěj **z adresáře `xpup-cursor-pack`**.
Po restartu počítače otevři terminál, přejdi zpět do tohoto adresáře
a podle potřeby spusť `docker compose up -d`.
Na Windows a macOS musí nejdříve běžet Docker Desktop.

| Chci | Příkaz |
|---|---|
| Zjistit stav všech služeb | `docker compose ps -a` |
| Zobrazit logy aplikace | `docker compose logs --tail=100 app` |
| Sledovat aktuální logy | `docker compose logs -f app` (ukonči Ctrl+C) |
| Zastavit lab | `docker compose down` |
| Znovu spustit bez sestavení | `docker compose up -d` |
| Restartovat jen aplikaci | `docker compose restart app` |
| Aktualizovat zdrojáky a image | viz níže |

### Aktualizace

```sh
git pull --ff-only
docker compose up -d --build
```

Při běžném restartu, zastavení nebo aktualizaci zůstávají data v Docker
named volumes.

### Návrat do úplně čistého stavu – smaže tvá cvičná data

```sh
docker compose down --volumes
docker compose up -d --build
```

Tím smažeš **účty vytvořené během cvičení, změny hesel, objednávky,
e-maily a nahrané soubory** tohoto lokálního labu. Znovu se vytvoří
výchozí cvičná data. Běžný `docker compose down` bez `--volumes`
data **nemaže**.

## 7. Když něco nefunguje

### Příkaz docker není nalezen nebo nemá Compose

Na Windows/macOS zkontroluj instalaci Docker Desktop a otevři nový
terminál. Na Linuxu ověř `docker --version` a
`docker compose version`. Doinstaluj Compose **V2 plugin**,
nepoužívej `docker-compose`.

### Cannot connect to the Docker daemon

Na Windows/macOS otevři Docker Desktop a vyčkej, až bude běžet engine.
Na Linuxu zkontroluj daemon:

```bash
sudo systemctl status docker.service
```

Případně ho spusť:

```bash
sudo systemctl start docker.service
```

### Permission denied při přístupu k Docker socketu (Linux)

Nemáš oprávnění k Docker daemonu. Použij Docker příkazy s `sudo`,
nebo postup pro skupinu `docker` v sekci Linux. Neměň ručně
vlastníky souborů v repozitáři ani ve volumes.

### Port 3000 nebo 3080 už někdo používá

Uprav **kořenový soubor `.env`**. Ponech v něm původní řádek
`COMPOSE_FILE=compose.yaml` a přidej:

```dotenv
XPUP_STUDENT_APP_PORT=3300
XPUP_STUDENT_MAILBOX_PORT=3380
```

Na Windows otevři soubor např. pomocí Notepadu (v PowerShellu
`notepad .env`). Na macOS/Linux použij svůj textový editor.
Potom spusť:

```sh
docker compose up -d
```

Nové adresy budou `http://127.0.0.1:3300` a
`http://127.0.0.1:3380`. Není potřeba měnit aplikační kód.

### Kontejner restartuje nebo vrací HTTP chybu

Zkontroluj celý stav a relevantní logy:

```sh
docker compose ps -a
docker compose logs --tail=100 app
docker compose logs --tail=100 fetch-worker mailbox catalog-worker fixtures
```

Pokud se po prvním spuštění stránky ještě nenačítají,
zkontroluj, zda se aplikace dokončila inicializovat. Nepovažuj
pouhý stav `Up` za důkaz správného fungování všech funkcí.

### Git clone vrací Repository not found / Authentication failed

Použij správný GitHub účet se schváleným přístupem do privátního
repozitáře. Pokud se přihlašuješ přes HTTPS, Git může otevřít
prohlížeč pro přihlášení. Samotné otevření URL repozitáře
v prohlížeči bez přihlášení přístup nezajistí.

## 8. Důležité informace a ověřená kompatibilita

- Toto je **záměrně zranitelná cvičná aplikace**. Testuj pouze svou
  instanci a cíle určené pro kurz, ne skutečné cizí služby.
- Porty aplikace a schránky jsou v lokálním Compose namapované na
  `127.0.0.1` – jsou určeny pro přístup **z tvého počítače**,
  nikoliv pro sdílení do sítě nebo publikaci na internetu.
- Všechna cvičná data jsou lokální a uložená v Docker volumes.
- **Runtime ověřeno:** čistý klon, sestavení, spuštění a vybraná
  automatizovaná regrese L1–L9 na **Arch Linuxu x86-64**;
  výsledky poslední sady **25 PASS, 0 FAIL, 4 SKIP**.
- **Dosud runtime neověřeno:** Windows Docker Desktop, macOS Intel,
  macOS Apple Silicon, úplné pokrytí všech dílčích acceptance criteria,
  manuální výukový průchod v DevTools a izolace mezi zařízeními.
  Úspěšná instalace na Linuxu tedy **není důkazem**, že build
  na každém Windows/Macu bez problémů projde.

