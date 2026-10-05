(() => {
  'use strict';

  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');

  // 遊戲使用固定座標系，CSS 只負責縮放，避免手機尺寸改變物理判定。
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = 286;
  const STORAGE_KEY = 'dino-runner-high-score';

  const COLORS = {
    sky: '#dff1f3',
    ink: '#193b35',
    muted: '#789087',
    ground: '#5b914c',
    groundLight: '#b3d98a',
    orange: '#df8b4e',
    cactus: '#376b48',
  };

  const player = {
    x: 112,
    y: GROUND_Y - 52,
    width: 42,
    height: 52,
    velocityY: 0,
    grounded: true,
    runTime: 0,
  };

  let state = 'ready';
  let obstacles = [];
  let groundOffset = 0;
  let elapsed = 0;
  let score = 0;
  let speed = 360;
  let spawnTimer = 1.2;
  let skyTime = 0;
  let lifeTokenUsed = false;
  let shieldTimer = 0;
  let previousTime = 0;
  let highScore = readHighScore();

  // 讀取儲存資料時一併檢查格式，避免損壞的資料影響遊戲啟動。
  function readHighScore() {
    try {
      const savedScore = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(savedScore) && savedScore > 0 ? savedScore : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore() {
    try {
      localStorage.setItem(STORAGE_KEY, String(highScore));
    } catch {
      // 私密瀏覽等環境可能停用儲存功能；遊戲本身仍可正常遊玩。
    }
  }

  function resetGame() {
    state = 'playing';
    obstacles = [];
    elapsed = 0;
    score = 0;
    speed = 360;
    spawnTimer = 1.15;
    lifeTokenUsed = false;
    shieldTimer = 0;
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.grounded = true;
    player.runTime = 0;
  }

  // 只允許在地面起跳，避免空中連跳；按鍵與點擊共用同一入口。
  function jump() {
    if (state === 'ready') {
      resetGame();
      return;
    }

    if (state === 'gameover') {
      resetGame();
      return;
    }

    if (player.grounded) {
      player.velocityY = -690;
      player.grounded = false;
    }
  }

  function handleKeyDown(event) {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      jump();
      return;
    }

    if (event.key.toLowerCase() === 'r' && state === 'gameover') {
      resetGame();
    } else if (state === 'ready' && event.key !== 'Tab') {
      resetGame();
    }
  }

  function handlePointerDown() {
    canvas.focus({ preventScroll: true });
    jump();
  }

  function createObstacle() {
    const height = 30 + Math.random() * 35;
    const width = 22 + Math.random() * 15;
    obstacles.push({
      x: WIDTH + 20,
      y: GROUND_Y - height,
      width,
      height,
      variant: Math.random() > 0.5 ? 'tall' : 'wide',
    });
  }

  function intersects(first, second) {
    // 縮小碰撞箱，讓視覺邊緣擦過障礙時手感更自然。
    const insetX = 7;
    const insetY = 5;
    return (
      first.x + insetX < second.x + second.width - 3 &&
      first.x + first.width - insetX > second.x + 3 &&
      first.y + insetY < second.y + second.height &&
      first.y + first.height - insetY > second.y
    );
  }

  function endGame() {
    state = 'gameover';
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
  }

  function update(deltaTime) {
    if (state !== 'playing') return;

    elapsed += deltaTime;
    shieldTimer = Math.max(0, shieldTimer - deltaTime);
    score = Math.floor(elapsed * 10);
    speed = Math.min(360 + elapsed * 7, 650);
    groundOffset = (groundOffset + speed * deltaTime) % 48;
    player.runTime += deltaTime * (player.grounded ? speed / 35 : 0);

    // 半隱式歐拉積分：先更新速度，再更新位置，讓落地行為穩定。
    player.velocityY += 1900 * deltaTime;
    player.y += player.velocityY * deltaTime;
    if (player.y + player.height >= GROUND_Y) {
      player.y = GROUND_Y - player.height;
      player.velocityY = 0;
      player.grounded = true;
    }

    spawnTimer -= deltaTime;
    if (spawnTimer <= 0) {
      createObstacle();
      spawnTimer = 0.95 + Math.random() * 0.8 + Math.max(0, 340 - speed) / 1200;
    }

    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      obstacle.x -= speed * deltaTime;
      if (intersects(player, obstacle)) {
        if (!lifeTokenUsed) {
          lifeTokenUsed = true;
          shieldTimer = 1.1;
          obstacles.splice(index, 1);
        } else {
          endGame();
        }
        break;
      }
    }
    obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);
  }

  function drawCloud(x, y, scale) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = 'rgba(255, 255, 255, 0.94)';
    context.beginPath();
    context.moveTo(-28, 10);
    context.bezierCurveTo(-40, 10, -39, -5, -27, -6);
    context.bezierCurveTo(-25, -19, -8, -21, -2, -10);
    context.bezierCurveTo(7, -26, 29, -19, 27, -4);
    context.bezierCurveTo(43, -3, 40, 11, 27, 11);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPlane(x, y) {
    context.save();
    context.translate(x, y + Math.sin(skyTime * 2.4) * 2);
    context.fillStyle = '#fff';
    context.strokeStyle = '#6d9cad';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-28, -2);
    context.lineTo(-7, -2);
    context.lineTo(-2, -15);
    context.lineTo(4, -15);
    context.lineTo(3, -2);
    context.lineTo(22, -1);
    context.lineTo(31, 1);
    context.lineTo(22, 3);
    context.lineTo(3, 4);
    context.lineTo(5, 13);
    context.lineTo(0, 13);
    context.lineTo(-7, 4);
    context.lineTo(-24, 5);
    context.lineTo(-30, 3);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawSkyObjects() {
    const cloudSpan = WIDTH + 100;
    const clouds = [
      { x: 90, y: 72, scale: 0.9, drift: 8 },
      { x: 425, y: 126, scale: 0.72, drift: 5 },
      { x: 745, y: 82, scale: 1.05, drift: 11 },
    ];

    for (const cloud of clouds) {
      const x = ((cloud.x - skyTime * cloud.drift) % cloudSpan + cloudSpan) % cloudSpan - 50;
      drawCloud(x, cloud.y, cloud.scale);
    }

    const planeX = ((120 + skyTime * 42) % (WIDTH + 100)) - 50;
    drawPlane(planeX, 92);
  }

  function drawBackground() {
    context.fillStyle = COLORS.sky;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    drawSkyObjects();

    // 遠方層疊的草坡延伸到地平線，營造開闊的綠地景深。
    context.fillStyle = '#c5e3a5';
    context.beginPath();
    context.moveTo(0, 252);
    context.quadraticCurveTo(150, 196, 322, 244);
    context.quadraticCurveTo(500, 208, 690, 247);
    context.quadraticCurveTo(820, 207, WIDTH, 230);
    context.lineTo(WIDTH, HEIGHT);
    context.lineTo(0, HEIGHT);
    context.closePath();
    context.fill();

    const meadowGradient = context.createLinearGradient(0, 238, 0, HEIGHT);
    meadowGradient.addColorStop(0, '#a8d779');
    meadowGradient.addColorStop(0.45, '#8bc85e');
    meadowGradient.addColorStop(1, '#72b34f');
    context.fillStyle = meadowGradient;
    context.beginPath();
    context.moveTo(0, 265);
    context.quadraticCurveTo(176, 239, 350, 264);
    context.quadraticCurveTo(590, 282, 760, 251);
    context.quadraticCurveTo(870, 236, WIDTH, 260);
    context.lineTo(WIDTH, HEIGHT);
    context.lineTo(0, HEIGHT);
    context.closePath();
    context.fill();

    // 草葉稀疏分布在前景，保留障礙物與跑道的清晰度。
    context.strokeStyle = 'rgba(56, 111, 58, 0.22)';
    context.lineWidth = 2;
    for (let x = -groundOffset; x < WIDTH; x += 44) {
      const index = Math.floor((x + groundOffset) / 44);
      const tuftY = GROUND_Y + 18 + ((index % 3 + 3) % 3) * 15;
      context.beginPath();
      context.moveTo(x, tuftY + 5);
      context.lineTo(x + 3, tuftY);
      context.moveTo(x + 5, tuftY + 5);
      context.lineTo(x + 8, tuftY - 2);
      context.stroke();
    }

    context.strokeStyle = COLORS.ground;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, GROUND_Y + 1);
    context.lineTo(WIDTH, GROUND_Y + 1);
    context.stroke();

    context.fillStyle = COLORS.groundLight;
    for (let x = -groundOffset; x < WIDTH; x += 48) {
      context.fillRect(x, GROUND_Y + 12, 20, 2);
    }
  }

  function drawPlayer() {
    const bounce = player.grounded && state === 'playing' ? Math.sin(player.runTime * 8) * 2 : 0;
    const x = player.x;
    const y = player.y + bounce;
    const legSwing = player.grounded && state === 'playing' ? Math.sin(player.runTime * 12) * 5 : 0;

    if (shieldTimer > 0) {
      context.save();
      context.beginPath();
      context.ellipse(x + 22, y + 27, 34, 37, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(229, 167, 66, ${0.45 + shieldTimer * 0.35})`;
      context.lineWidth = 4;
      context.stroke();
      context.restore();
    }

    // 尾巴、背刺與長吻輪廓讓角色一眼看起來更像小型暴龍。
    context.fillStyle = COLORS.ink;
    context.beginPath();
    context.moveTo(x + 13, y + 25);
    context.lineTo(x - 5, y + 18);
    context.lineTo(x + 2, y + 31);
    context.lineTo(x + 15, y + 35);
    context.closePath();
    context.fill();

    context.fillRect(x + 9, y + 20, 25, 25);
    context.fillRect(x + 23, y + 13, 13, 19);
    context.fillRect(x + 27, y + 5, 17, 16);
    context.fillRect(x + 38, y + 12, 12, 8);
    context.fillRect(x + 32, y + 19, 16, 4);

    context.beginPath();
    context.moveTo(x + 12, y + 21);
    context.lineTo(x + 15, y + 13);
    context.lineTo(x + 19, y + 21);
    context.lineTo(x + 21, y + 11);
    context.lineTo(x + 26, y + 20);
    context.closePath();
    context.fill();

    // 淺色腹部、眼睛與短手臂加強角色層次。
    context.fillStyle = '#8eb28a';
    context.fillRect(x + 20, y + 34, 12, 6);
    context.fillStyle = COLORS.ink;
    context.fillRect(x + 29, y + 25, 8, 4);
    context.fillRect(x + 35, y + 27, 4, 3);

    context.fillStyle = '#f8faf5';
    context.fillRect(x + 37, y + 9, 4, 4);
    context.fillStyle = COLORS.ink;
    context.fillRect(x + 39, y + 10, 2, 2);

    // 跑步時交替擺腿，跳躍時收腿；腳爪用暖色做出小小的辨識點。
    context.fillStyle = COLORS.orange;
    if (player.grounded) {
      context.fillRect(x + 13 + legSwing, y + 42, 8, 8);
      context.fillRect(x + 27 - legSwing, y + 42, 8, 8);
      context.fillRect(x + 10 + legSwing, y + 48, 9, 3);
      context.fillRect(x + 25 - legSwing, y + 48, 9, 3);
    } else {
      context.fillRect(x + 13, y + 41, 8, 7);
      context.fillRect(x + 27, y + 41, 8, 7);
      context.fillRect(x + 10, y + 46, 9, 3);
      context.fillRect(x + 25, y + 46, 9, 3);
    }
  }

  function drawObstacle(obstacle) {
    const { x, y, width, height } = obstacle;
    context.fillStyle = COLORS.cactus;
    context.fillRect(x + width * 0.32, y, width * 0.38, height);
    context.fillRect(x, y + height * 0.43, width * 0.38, 8);
    context.fillRect(x, y + height * 0.25, 8, height * 0.2);
    context.fillRect(x + width * 0.65, y + height * 0.58, width * 0.35, 8);
    context.fillRect(x + width * 0.65, y + height * 0.4, 8, height * 0.2);
  }

  function drawScore() {
    context.textAlign = 'right';
    context.textBaseline = 'top';
    context.fillStyle = COLORS.ink;
    context.font = '500 15px "DM Mono", monospace';
    context.fillText(`SCORE  ${String(score).padStart(5, '0')}`, WIDTH - 34, 26);
    context.fillStyle = COLORS.muted;
    context.font = '400 12px "DM Mono", monospace';
    context.fillText(`BEST  ${String(highScore).padStart(5, '0')}`, WIDTH - 34, 49);

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = lifeTokenUsed ? '#899890' : '#c48632';
    context.beginPath();
    context.moveTo(25, 20);
    context.lineTo(34, 24);
    context.lineTo(33, 34);
    context.lineTo(25, 40);
    context.lineTo(17, 34);
    context.lineTo(16, 24);
    context.closePath();
    context.fill();
    context.fillStyle = '#fff';
    context.font = '500 13px "Noto Sans TC", sans-serif';
    context.fillText(lifeTokenUsed ? '免死金牌 已使用' : '免死金牌 1 次', 42, 30);
  }

  function drawMessage(title, subtitle, accent) {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = accent;
    context.font = '800 30px Manrope, "Noto Sans TC", sans-serif';
    context.fillText(title, WIDTH / 2, 132);
    context.fillStyle = '#60776c';
    context.font = '500 14px Manrope, "Noto Sans TC", sans-serif';
    context.fillText(subtitle, WIDTH / 2, 165);
  }

  function render() {
    drawBackground();
    for (const obstacle of obstacles) drawObstacle(obstacle);
    drawPlayer();
    drawScore();

    if (state === 'ready') {
      drawMessage('準備好了嗎？', '按任意鍵或點擊畫面開始', COLORS.ink);
    } else if (state === 'gameover') {
      drawMessage('遊戲結束', '按 R 或點擊畫面，再跑一次', COLORS.orange);
    }
  }

  function gameLoop(timestamp) {
    const deltaTime = previousTime === 0 ? 0 : Math.min((timestamp - previousTime) / 1000, 0.032);
    previousTime = timestamp;
    skyTime += deltaTime;
    update(deltaTime);
    render();
    requestAnimationFrame(gameLoop);
  }

  window.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('pointerdown', handlePointerDown);
  render();
  requestAnimationFrame(gameLoop);
})();