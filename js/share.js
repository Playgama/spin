// Share page of the Boost slot. The QR code of a win brings a phone here with
// ?g=<game id>&p=<players>; the page offers a ready post about it.

const $ = (id) => document.getElementById(id);

async function start() {
  const query = new URLSearchParams(location.search);
  const players = Number(query.get('p'));
  const covers = await (await fetch('assets/covers/covers.json', { cache: 'no-cache' })).json();
  const game = covers.find((cover) => cover.id === query.get('g'));
  if (!game || (players !== 50 && players !== 100)) {
    $('gain').textContent = 'Nothing to share yet';
    $('whom').textContent = 'Spin the Playgama Boost slot first';
    return;
  }

  const link = `https://playgama.ai/${game.id}`; // the game's public page in the sandbox
  const post = [
    `I just sent +${players} players to ${game.title} on the Playgama Boost slot machine 🎰`,
    "Why? Because I'm nice. And so is Playgama.",
    link,
  ].join(' '); // one paragraph

  $('cover').src = `assets/covers/${game.file}`;
  $('cover').alt = game.title;
  $('cover').hidden = false;
  $('gain').textContent = `+${players} players`;
  $('whom').textContent = game.title;
  $('post').textContent = post;
  $('ready').hidden = false;

  // LinkedIn fills in nothing but the link, so the text goes to the clipboard on the way there.
  $('linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: link })}`;
  $('linkedin').addEventListener('click', () => {
    navigator.clipboard?.writeText(post).catch(() => {});
  });
  $('x').href = `https://x.com/intent/post?${new URLSearchParams({ text: post })}`;
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(post);
    } catch {
      getSelection().selectAllChildren($('post')); // no clipboard here: leave the text selected to copy by hand
      return;
    }
    $('copy-label').textContent = 'Copied';
    setTimeout(() => { $('copy-label').textContent = 'Copy text'; }, 2000);
  });
}

start();
