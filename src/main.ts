import './ui/styles.css';
import { Game } from './core/Game';
import { createAudio } from './audio/createAudio';

/** Entry point: checks WebGL2 support, boots the game and exposes a debug handle. */
async function boot(): Promise<void> {
  const root = document.getElementById('game-root');
  if (!root) throw new Error('#game-root missing');

  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) {
    root.innerHTML = `<div class="fatal">Ember of Retribution requires WebGL 2. Please use a current version of Chrome, Edge, Firefox or Safari.</div>`;
    return;
  }

  const game = new Game(root);
  game.setAudio(createAudio());
  const debug = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  if (debug) (window as unknown as { __game: Game }).__game = game;

  await game.init();
  game.start();
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('game-root');
  if (root) root.insertAdjacentHTML('beforeend', `<div class="fatal">Failed to start: ${String(err?.message ?? err)}</div>`);
});
