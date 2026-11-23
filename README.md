# Sleep Stage Calculator

A lightweight, offline friendly browser tool for reconstructing WHOOP sleep stage intervals. It keeps stage data in the page only and has no backend or account.

## Run locally

Open `index.html` in a modern browser. For clipboard support, browsers may require a secure context; if copying is unavailable from a local file, run a simple local static server from this folder (for example, `python -m http.server 8000`) and open `http://localhost:8000`.

Enter the start and end date/time, then each stage's hours and minutes. Awake time is calculated from the sleep window. Select **Generate timeline** to create the chronological intervals; select **Regenerate** to redistribute awake minutes while keeping the stage totals and order. **Copy results** copies the intervals, and **Reset** clears the form.

The output always follows Core → Deep → REM, with awake intervals allocated among the four gaps. All durations use elapsed minutes from the original start timestamp.
