export default {
  fetch(request) {
    const destination = new URL(request.url);
    destination.protocol = 'https:';
    destination.host = 'blackburn-flight.pages.dev';
    return Response.redirect(destination.href, 302);
  }
};
