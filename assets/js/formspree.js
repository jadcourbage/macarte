var form = document.getElementById("contact-form");
    
async function handleSubmit(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  fetch(event.target.action, {
	method: form.method,
	body: data,
	headers: {
		'Accept': 'application/json'
	}
  }).then(response => {
	if (response.ok) {
	  $('#aboutModal').modal('hide');
	  alert("Merci !");
	  form.reset()
	} else {
	  response.json().then(data => {
		if (Object.hasOwn(data, 'errors')) {
		  status.innerHTML = data["errors"].map(error => error["message"]).join(", ")
		} else {
			form.append('<div class="alert alert--error">Erreur :-(</div>')
		}
	  })
	}
  }).catch(error => {
	form.append('<div class="alert alert--error">Erreur :-(</div>')
  });
}
form.addEventListener("submit", handleSubmit)