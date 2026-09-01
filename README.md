# Basketball Agenda

Mobiele webapp voor Nederlandse basketbalwedstrijden, uitslagen en tafel-/scheidsrechtertaken.

## Functies

- online zoeken naar Nederlandse basketbalverenigingen;
- team kiezen uit de actuele teams van de gevonden vereniging;
- vereniging en team blijven lokaal opgeslagen na sluiten/heropenen;
- bij openen worden wedstrijden van het gekozen team live opgehaald;
- programma, locatie, wedstrijdstatus en uitslag komen uit de publieke FOYS-competitiegegevens die Basketball.nl gebruikt;
- iedere wedstrijd blijft gekoppeld aan het unieke FOYS-wedstrijd-ID, zodat een later ingevoerde uitslag bij dezelfde wedstrijd terechtkomt;
- gezamenlijke chronologische agenda met wedstrijden en taken;
- aparte weergaven voor wedstrijden en taken;
- persoonsfilter voor het aangeleverde taakrooster: `Alle personen` of één persoon;
- persoonskeuze blijft lokaal opgeslagen;
- laatst succesvol opgehaalde wedstrijden worden lokaal gecachet voor tijdelijk offline gebruik;
- PWA/service-worker voor de lokale app-shell;
- agenda-abonnementen via standaard iCalendar/ICS voor Google Agenda, Outlook, Apple Agenda en andere agenda-aanbieders;
- aparte abonnementslink voor het gekozen team en voor het gekozen persoonsfilter;
- eenmalige gecombineerde `.ics`-export is ook beschikbaar.

## Live gegevens

De webapp gebruikt de publieke competitie-endpoints van FOYS die door Basketball.nl worden gebruikt. De federatie-, club-, team- en wedstrijd-ID's worden als echte identifiers bewaard; de applicatie probeert teams en wedstrijden dus niet op basis van alleen een zichtbare naam aan elkaar te koppelen.

Het huidige seizoen wordt bepaald van juli tot en met juni. Wedstrijden worden live opgehaald voor het gekozen `teamGuid`. Een gespeelde wedstrijd gebruikt de scorevelden van exact hetzelfde wedstrijdrecord.

## Agenda-abonnementen

GitHub Actions genereert voor het actuele seizoen statische ICS-abonnementsfeeds onder:

- `cal/teams/<team-guid>.ics`
- `cal/tasks/all.ics`
- `cal/tasks/<persoon>.ics`

De feedgenerator haalt periodiek de actuele FOYS-wedstrijdgegevens op. Wedstrijden houden een stabiele `UID` op basis van het FOYS-wedstrijd-ID. Hierdoor kan een agenda-abonnement dezelfde afspraak bijwerken als tijd, locatie, status of uitslag verandert.

De feeds worden iedere 12 uur gecontroleerd. Alleen wanneer de inhoud daadwerkelijk is veranderd wordt een nieuwe commit gemaakt. Hoe snel een wijziging daarna in Google Agenda, Outlook, Apple Agenda of een andere aanbieder verschijnt, wordt mede bepaald door de verversfrequentie van die agenda-aanbieder.

## Taken

Het aangeleverde scheidsrechter- en tafelschema voor de eerste helft van seizoen 2026-2027 staat gestructureerd in `data/tasks.json`. De app kan alle taken tonen of deze op één persoon filteren.

## Hosting

De app is een statische GitHub Pages-app en gebruikt geen eigen applicatieserver. `index.html`, `app.js`, `styles.css`, `manifest.webmanifest` en `sw.js` vormen de client. De kalenderfeeds worden door GitHub Actions gegenereerd en daarna eveneens via GitHub Pages aangeboden.
