# Toxic Bar – studentský výukový lab

Postup instalace na Windows, macOS a Linuxu: [STUDENT_GUIDE.md](STUDENT_GUIDE.md).

## Lokální spuštění

```sh
git clone https://github.com/Invisible-Infra/xpup-toxic-bar.git
cd xpup-toxic-bar
docker compose up -d --build
```

- Aplikace: `http://127.0.0.1:3000`
- Cvičná poštovní schránka: `http://127.0.0.1:3080`
- Výchozí účty: [UCTY.md](UCTY.md)

Obsahuje upravený OWASP Juice Shop. Licence upstreamu je v [fork/LICENSE](fork/LICENSE).
Aplikace je záměrně zranitelná a určena výhradně pro lokální cvičení.
