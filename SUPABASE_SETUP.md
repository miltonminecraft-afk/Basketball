# Basketball ledenomgeving

De Basketball-app gebruikt Supabase voor leden, meerdere teams per lid, aanwezigheid, beheeragenda, trainingen, taken, taakwissels en meldingen.

## Eenmalige Auth-instelling

Open in Supabase het project **Basketball** en ga naar **Authentication → URL Configuration**.

- Site URL: `https://miltonminecraft-afk.github.io/Basketball/`
- Redirect URLs: voeg `https://miltonminecraft-afk.github.io/Basketball/**` toe.

De app gebruikt aanvankelijk passwordless e-mail-login (Magic Link). Een nieuw ingelogd account krijgt pas clubtoegang als het overeenkomt met een actief lid in de ledenadministratie.

## Eerste administrator

De leden uit het aangeleverde scheidsrechter- en tafelschema staan vooraf in de ledenlijst. De eerste administrator wordt niet als los nieuw adminaccount aangemaakt:

1. Log in via **Club** met je e-mailadres.
2. Vul de eenmalige bootstrapcode in.
3. Kies in **Bestaand lid** jouw bestaande ledenregel.
4. Bevestig met **Maak geselecteerd lid eerste admin**.

De gekozen ledenregel wordt aan het ingelogde Supabase-account gekoppeld en krijgt de rol **Admin**. De bootstrapcode kan daarna niet opnieuw worden gebruikt.

## Leden en extra administrators

1. Log als admin in en open **Club → Admin → Leden**.
2. Bestaande leden uit het aangeleverde schema staan al in de lijst.
3. Open **Wijzigen** om e-mailadres, telefoon, actief-status en één of meerdere teams aan een lid toe te voegen.
4. Voor een persoon die nog niet bestaat gebruik je **Nieuw lid**. Nieuwe personen worden altijd eerst als normaal **Lid** aangemaakt.
5. Om een extra administrator te maken kies je onder **Administrator toevoegen** een bestaand lid en druk je op **Maak geselecteerd lid admin**.
6. Het lid opent dezelfde GitHub Pages-app, gaat naar **Club**, vult het gekoppelde e-mailadres in en gebruikt de ontvangen eenmalige inloglink.
7. Bij de eerste login wordt het Supabase-account automatisch aan de bestaande ledenregel gekoppeld.

Een lid kan aan meerdere teams gekoppeld zijn. Een admin kan deze koppelingen later altijd wijzigen.

## Aanwezigheid

Aanwezigheid is strikt **Ja** of **Nee**. Geen ingevoerd antwoord wordt alleen administratief beschouwd als **nog niet gereageerd** en is geen derde keuze.

## Taken wisselen

Een lid kan bij **Mijn taken** een taak openstellen met **Taak wisselen**. Actieve leden ontvangen daarvan een melding in de app. De eerste geldige overname wordt atomair vastgelegd; daarna kan dezelfde taak niet nogmaals door iemand anders worden overgenomen. De aanvrager, overnemer en admins ontvangen een bevestiging.

## Adminagenda

Admins kunnen in **Club → Admin → Agenda beheren** trainingen en taakmomenten toevoegen of verwijderen en taaktoewijzingen aanpassen. De data staat centraal in Supabase.

## SMS-login

SMS-login is nog niet actief. Supabase vereist daarvoor een externe SMS-provider. Totdat die provider is geconfigureerd, is passwordless e-mail-login de werkende verificatiemethode.
