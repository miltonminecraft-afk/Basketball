# Basketball Agenda

Mobiele webapp voor basketballwedstrijden en tafel-/scheidsrechtertaken.

## Functies

- gezamenlijke agenda met wedstrijden en taken;
- aparte wedstrijd- en takenweergave;
- teamselectie die lokaal bewaard blijft;
- persoonsselectie: `Alle personen` of één specifieke persoon;
- persoonsselectie blijft behouden na sluiten/heropenen;
- taakrooster eerste helft 2026-2027 verwerkt uit het aangeleverde SV Argon-schema;
- reserveprogramma voor SV Argon MSE-2 verwerkt uit de aangeleverde screenshots;
- live synchronisatie via een officiële Basketball.nl agenda-/iCal-koppeling van een team;
- laatst succesvol opgehaalde wedstrijden worden lokaal gecachet als reserve.

## Live Basketball.nl koppeling

De officiële FOYS developer-documentatie vermeldt dat directe API-toegang alleen beschikbaar is wanneer daar een overeenkomst voor bestaat. Daarom gebruikt deze app niet rechtstreeks een ongedocumenteerde FOYS-endpoint.

Gebruik in plaats daarvan de officiële agenda-koppeling van Basketball.nl:

1. Open Basketball.nl / de Basketball.nl-app.
2. Open de gewenste teampagina.
3. Gebruik het agenda-icoon om de agenda-koppeling voor het team te verkrijgen.
4. Plak de HTTPS/iCal-link in **Instellingen → Basketball.nl agenda-link**.
5. Vanaf dat moment probeert de app bij iedere start het actuele programma op te halen.

Als synchronisatie niet lukt, blijft de laatst succesvol opgehaalde agenda of de ingebouwde reserve-agenda zichtbaar.

## Hosting

De applicatie bestaat uit één `index.html` en is geschikt voor GitHub Pages.
