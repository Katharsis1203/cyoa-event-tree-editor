const e_container = document.getElementById("event-container");
const btn_explore = document.getElementById("explore-btn");
const e_template = document.getElementById("event-template");

const items = [
    { title: "Mountain", image: "images/forest.jpg" },
    { title: "Forest", image: "images/forest.jpg" },
    { title: "Ocean", image: "images/forest.jpg" }
];

btn_explore.addEventListener("click", refreshContainer);

function removeEvent() {
    const placeholder = document.createElement("div");
    placeholder.className = "event-box";
    placeholder.textContent = "Empty";
    this.parentElement.replaceWith(placeholder);
}


function refreshContainer() {
    e_container.innerHTML = "";

    items.forEach(item => {
        const clone = e_template.content.cloneNode(true);
        clone.querySelector(".event-card-title").textContent = item.title;
        clone.querySelector(".event-card-image").src = item.image;
        clone.querySelector(".delete-event-btn").addEventListener("click", removeEvent)
        e_container.appendChild(clone);

    })
}