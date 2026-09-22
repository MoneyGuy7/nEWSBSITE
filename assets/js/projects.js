// ============================================================
// projects.js — renders YAKTON_PROJECTS (see projects-data.js)
// ============================================================

(function () {
  const grid = document.getElementById("projectGrid");
  if (!grid || typeof YAKTON_PROJECTS === "undefined") return;

  if (!YAKTON_PROJECTS.length) {
    grid.innerHTML = `
      <div class="coming-soon">
        <span class="coming-soon-mark" aria-hidden="true"></span>
        <h3>Coming soon</h3>
        <p>Nothing posted yet — projects will show up here as they're ready to share.</p>
      </div>`;
    return;
  }

  grid.innerHTML = YAKTON_PROJECTS.map((p) => `
    <div class="panel project-card">
      <span class="project-tag">${p.tag}</span>
      <h3>${p.title}</h3>
      <p>${p.description}</p>
      <div class="project-foot">
        <span>${p.size}</span>
        <a class="btn btn-sm" href="${p.file}" download>Download</a>
      </div>
    </div>
  `).join("");
})();
