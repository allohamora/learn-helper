# Learn Helper

Learn Helper is a self-hosted web app for learning English vocabulary. It is built around the [Oxford 5000](https://www.oxfordlearnersdictionaries.com/) word lists and phrase lists, with Ukrainian translations.

Pick a list, tell the app what you already know, and learn the rest with short exercises. AI helps where it saves time: it writes example sentences, generates new items and translates text you select in your own PDFs.

![Vocabulary lists](images/lists-desktop-dark.png)

## Features

### Vocabulary lists

- Oxford 5000 and Oxford Phrase List, split by level from A1 to C1. Add the lists you need to your account.
- A progress bar shows how many items you have learned in each list.
- Every item has its pronunciation with audio, Ukrainian translation, definition, part of speech and a link to the Oxford dictionary entry.
- Search the items of a list and filter them by status: waiting, learning or known.
- Edit the translation of an item, reset its progress or remove it from your list.

<p>
  <img src="images/lists-desktop-dark.png" alt="Vocabulary lists on desktop" width="100%">
</p>

<p>
  <img src="images/lists-mobile-dark.png" alt="Vocabulary lists on mobile" width="30%">
</p>

### Discover

- Go through a list and mark each item as `I Know This` or `Learn This`.
- Made a mistake? Undo it.

<p>
  <img src="images/discover-desktop-dark.png" alt="Discover on desktop" width="100%">
</p>

<p>
  <img src="images/discover-mobile-dark.png" alt="Discover on mobile" width="30%">
</p>

### Learn

- Every session starts with a showcase of the new items.
- Then come the exercises: pick the definition or the translation of an item, type the item from its definition, translation or pronunciation, and arrange the words of an AI-written sentence in both directions, English to Ukrainian and Ukrainian to English.
- Type the answers or say them with speech recognition.
- Use hints when you are stuck. Mistakes come back as retries.
- The session result shows the mistakes per item. You decide when an item is learned: move it to the next step yourself, or keep practicing it in the next session.

**Showcase**

<p>
  <img src="images/learn-showcase-desktop-dark.png" alt="Showcase on desktop" width="100%">
</p>

<p>
  <img src="images/learn-showcase-mobile-dark.png" alt="Showcase on mobile" width="30%">
</p>

**Exercise**

<p>
  <img src="images/learn-task-desktop-dark.png" alt="Exercise on desktop" width="100%">
</p>

<p>
  <img src="images/learn-task-mobile-dark.png" alt="Exercise on mobile" width="30%">
</p>

**Session result**

<p>
  <img src="images/learn-result-desktop-dark.png" alt="Session result on desktop" width="100%">
</p>

<p>
  <img src="images/learn-result-mobile-dark.png" alt="Session result on mobile" width="30%">
</p>

### Personal list

- Search the Oxford items and add them to your personal list.
- Or generate an item with AI from any word or phrase, with an optional context to pick the right meaning.

<p>
  <img src="images/personal-desktop-dark.png" alt="Personal list on desktop" width="100%">
</p>

<p>
  <img src="images/personal-mobile-dark.png" alt="Personal list on mobile" width="30%">
</p>

### Readings

- Upload a PDF and read it in the app, with zoom and page navigation.
- Select a word or a phrase to get an AI translation that takes the surrounding text into account.
- Add the translated word or phrase to your personal list in one tap.
- Your page and reading time are saved for every reading.

<p>
  <img src="images/reading-desktop-dark.png" alt="Readings on desktop" width="100%">
</p>

<p>
  <img src="images/reading-mobile-dark.png" alt="Readings on mobile" width="30%">
</p>

### Statistics

- Counters for discovered items, completed tasks, mistakes, retries, hints, generated items, readings and translations.
- Time spent learning, discovering and reading, and the average time per task.
- AI cost and tokens.
- Daily charts for discovery, learning activity, AI cost, edits and reading.
- The items with the most mistakes and the most hints.

<p>
  <img src="images/statistics-desktop-dark.png" alt="Statistics on desktop" width="100%">
</p>

<p>
  <img src="images/statistics-mobile-dark.png" alt="Statistics on mobile" width="30%">
</p>

### Accounts and themes

- Email and password login, with optional Google login.
- Only the emails you allow can sign up, and every user has their own data.
- Dark and light theme, with a layout for desktop and mobile.

### Light theme

<details>
<summary>Show light theme screenshots</summary>

<p>
  <img src="images/lists-desktop-light.png" alt="Lists in light theme" width="48%">
  <img src="images/learn-task-desktop-light.png" alt="Exercise in light theme" width="48%">
  <img src="images/reading-desktop-light.png" alt="Readings in light theme" width="48%">
  <img src="images/statistics-desktop-light.png" alt="Statistics in light theme" width="48%">
</p>

</details>

## Self-hosting

You need [Docker](https://docs.docker.com/get-docker/) with Compose and an [OpenRouter](https://openrouter.ai/) API key.

1. Get the code and create your `.env` from the example:

   ```bash
   git clone https://github.com/allohamora/learn-helper.git
   cd learn-helper
   cp .env.example .env
   ```

2. Fill in `.env`. Set these values and leave the rest as is:

   ```env
   BETTER_AUTH_SECRET=a-long-random-string
   BETTER_AUTH_URL=http://localhost:3000
   BETTER_AUTH_PROVIDERS=["local"]
   BETTER_AUTH_ALLOWED_USERS=["you@example.com"]
   OPENROUTER_API_KEY=your-openrouter-key
   ```

3. Start the app:

   ```bash
   docker compose --profile production up --build # build and start a new version
   docker compose --profile production up         # start without a rebuild
   ```

4. Load the Oxford lists once, from a second terminal:

   ```bash
   docker compose exec app npm run vocabulary:seed
   ```

5. Open `http://localhost:3000`, click `Sign up` and register with an email from `BETTER_AUTH_ALLOWED_USERS`.

### Google login (optional)

Follow the [Better Auth Google guide](https://www.better-auth.com/docs/authentication/google) to create the OAuth client. Use `<BETTER_AUTH_URL>/api/auth/callback/google` as the redirect URI, then set these values in `.env` and start the app with `--build`:

```env
BETTER_AUTH_PROVIDERS=["google", "local"]
BETTER_AUTH_GOOGLE_CLIENT_ID=your-client-id
BETTER_AUTH_GOOGLE_CLIENT_SECRET=your-client-secret
```
