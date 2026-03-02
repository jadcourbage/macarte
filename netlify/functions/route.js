exports.handler = async (event) => {
  const { start, end } = event.queryStringParameters || {};

  if (!start || !end) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing start or end parameter" }),
    };
  }

  const coordPattern = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
  if (!coordPattern.test(start) || !coordPattern.test(end)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid coordinate format. Expected: lng,lat" }),
    };
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ORS API key not configured" }),
    };
  }

  const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${apiKey}&start=${start}&end=${end}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 502,
      body: JSON.stringify({ error: isTimeout ? "Route service timed out" : "Failed to fetch route from upstream" }),
    };
  }
};
