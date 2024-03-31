const forEach = (arr, fn) => {
  let i, str = '';
  for (i = 0; i < arr.length; i++) str += fn(arr[i]);
  return str;
};

export const template = ({ searchUrl, query, days, videos, channelLinks }) => (`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>🦉 youtube subs</title>
  <link rel="stylesheet" href="./main.css">
</head>
<body>
    <header>
      <h1>🦉</h1>
      <div class="search">
        <form action="${searchUrl}" method="GET">
          <div class="input-group">
            <input type="text" class="text-input" name="${query}" placeholder="search" />
            <button type="submit">submit</button>
          </div>
        </form>
      </div>
    </header>

    <a class="github" href="https://github.com/kevinfiol/youtube">
      <small>github</small>
    </a>

    <main>
      <details class="subscriptions">
        <summary>Subscriptions</summary>
        <article>
          ${forEach(channelLinks, ({ name, url }) => `
            <a href="${url}">${name}</a>
          `)}
        </article>
      </details>
      ${forEach(days, day => `
        <div class="day">
          <h2>${day}</h2>
          <hr />
          <div class="videos">
            ${forEach(videos[day], video => `
              <div class="video">
                <a href="${video.link}">
                  <img src="${video.thumbnail}" loading="lazy" />
                </a>

                <p>
                  <a href="${video.link}">
                    ${video.title}
                  </a>
                </p>

                <p>
                  <a href="${video.channel}">
                    <strong>${video.author}&nbsp;</strong>
                  </a>
                </p>
              </div>
            `)}
          </div>
        </div>
      `)}
    </main>
</body>
</html>
`);