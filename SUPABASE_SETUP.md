# Basketball ledenomgeving

De Basketball-app gebruikt Supabase voor leden, meerdere teams per lid, aanwezigheid, beheeragenda, trainingen, taken, taakwissels en meldingen.

## Eenmalige Auth-instelling

Open in Supabase het project **Basketball** en ga naar **Authentication → URL Configuration**.

- Site URL: `https://miltonminecraft-afk.github.io/Basketball/`
- Redirect URLs: voeg `https://miltonminecraft-afk.github.io/Basketball/**` toe.

De app gebruikt aanvankelijk passwordless e-mail-login (Magic Link). Een nieuw ingelogd account krijgt pas clubtoegang als het overeenkomt met een actief lid in de ledenadministratie. De eerste beheerder gebruikt daarnaast de eenmalige bootstrapcode die buiten de repository wordt bewaard.

## Andere leden toegang geven

1. Log als admin in en open **Club → Admin → Leden**.
2. Kies **Nieuw lid**.
3. Vul naam en minimaal het e-mailadres in waarmee het lid gaat inloggen. Telefoon kan ook administratief worden opgeslagen.
4. Kies **Lid** of **Admin** en laat **Actief** ingeschakeld.
5. Vink één of meerdere teams aan en sla op.
6. Het lid opent dezelfde GitHub Pages-app, gaat naar **Club**, vult dat e-mailadres in en gebruikt de ontvangen eenmalige inloglink.
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
