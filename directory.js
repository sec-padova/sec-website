const members = Array.isArray(window.clubMembers) ? window.clubMembers : [];
const memberList = document.getElementById("member-list");
const memberCount = document.getElementById("member-count");

if (memberList && memberCount && members.length > 0) {
  const entries = members
    .filter((member) => member && typeof member.name === "string" && member.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length > 0) {
    const fragment = document.createDocumentFragment();

    entries.forEach((member) => {
      const row = document.createElement("li");
      row.className = "member-row";

      const mark = document.createElement("span");
      mark.className = "member-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = member.name.trim().charAt(0).toUpperCase();

      const identity = document.createElement("span");
      identity.className = "member-identity";
      const name = document.createElement("strong");
      name.textContent = member.name.trim();
      identity.append(name);

      if (typeof member.department === "string" && member.department.trim()) {
        const department = document.createElement("small");
        department.textContent = member.department.trim();
        identity.append(department);
      }

      row.append(mark, identity);

      if (typeof member.github === "string") {
        try {
          const profile = new URL(member.github);
          if (profile.protocol === "https:" && profile.hostname === "github.com" && profile.pathname.length > 1) {
            const link = document.createElement("a");
            link.href = profile.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "GitHub ↗";
            link.setAttribute("aria-label", `${member.name.trim()} on GitHub (opens in a new tab)`);
            row.append(link);
          }
        } catch {
          // Ignore a malformed optional profile URL.
        }
      }

      fragment.append(row);
    });

    memberList.replaceChildren(fragment);
    memberCount.textContent = `${entries.length} ${entries.length === 1 ? "member" : "members"}`;
  }
}
