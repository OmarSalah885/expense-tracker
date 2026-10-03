"use strict";

const API_URL = "http://localhost:3000/api/expenses";

const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];
const lightColors = {
  Food: "#22c55e",
  Transport: "#3b82f6",
  Bills: "#f59e0b",
  Entertainment: "#06b6d4",
  Other: "#8b5cf6",
};

const darkColors = {
  Food: "#22c55e",
  Transport: "#3b82f6",
  Bills: "#f59e0b",
  Entertainment: "#06b6d4",
  Other: "#8b5cf6",
};

let allExpenses = [];
let sortField = "date";
let sortDirection = "desc";
let categoryChart = null;

async function getExpenses() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}

async function addExpense(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP error: ${response.status}`);
  }
  return response.json();
}

async function updateExpense(id, data) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP error: ${response.status}`);
  }
  return response.json();
}

async function deleteExpense(id) {
  const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP error: ${response.status}`);
  }
}

function showErrorAlert(message) {
  const container = document.getElementById("alert-container");
  const alert = document.createElement("div");
  alert.className = "alert alert-danger alert-dismissible fade show mb-3";
  alert.setAttribute("role", "alert");
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  container.prepend(alert);
}

function getCategoryBadgeClass(category) {
  switch (category) {
    case "Food": return "badge-food";
    case "Transport": return "badge-transport";
    case "Bills": return "badge-bills";
    case "Entertainment": return "badge-entertainment";
    default: return "badge-other";
  }
}

function showSpinner(show) {
  const overlay = document.getElementById("loading-overlay");
  if (show) {
    overlay.classList.remove("overlay-hidden");
  } else {
    overlay.classList.add("overlay-hidden");
  }
}

function getFilteredAndSortedExpenses() {
  const search = document.getElementById("search-title").value.trim().toLowerCase();
  const month = document.getElementById("month-filter").value;
  const category = document.getElementById("category-filter").value;

  let list = [...allExpenses];

  if (search) {
    list = list.filter((e) => e.title.toLowerCase().includes(search));
  }

  if (month) {
    list = list.filter((e) => e.date.startsWith(month));
  }

  if (category !== "All") {
    list = list.filter((e) => e.category === category);
  }

  list.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === "amount") {
      valA = Number(valA);
      valB = Number(valB);
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return list;
}

function applyFilters() {
  renderTable(getFilteredAndSortedExpenses());
}

function renderSummary(expenses) {
  let total = 0;
  expenses.forEach((e) => (total += Number(e.amount) || 0));

  const highest = expenses.length
    ? expenses.reduce((max, cur) =>
        Number(cur.amount) > Number(max.amount) ? cur : max
      )
    : null;

  document.getElementById("total-amount").textContent = total.toFixed(2);
  document.getElementById("expense-count").textContent = expenses.length;
  document.getElementById("highest-amount").textContent = highest
    ? Number(highest.amount).toFixed(2)
    : "0.00";
  document.getElementById("highest-title").textContent = highest ? highest.title : "-";
}

function renderTable(expenses) {
  const tbody = document.getElementById("expense-tbody");
  tbody.innerHTML = "";

  expenses.forEach((expense) => {
    const tr = document.createElement("tr");
    tr.dataset.id = expense.id;
    tr.innerHTML = `
      <td>${expense.title}</td>
      <td class="text-end">${Number(expense.amount).toFixed(2)}</td>
      <td><span class="badge ${getCategoryBadgeClass(expense.category)}">${expense.category}</span></td>
      <td>${expense.date}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-secondary edit-btn">Edit</button>
        <button type="button" class="btn btn-sm btn-outline-danger delete-btn">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("tr").dataset.id;
      if (!confirm("Are you sure you want to delete this expense?")) return;
      try {
        showSpinner(true);
        await deleteExpense(id);
        await refresh();
      } catch (err) {
        showErrorAlert(err.message);
      } finally {
        showSpinner(false);
      }
    });
  });

  tbody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const cells = row.querySelectorAll("td");
      document.getElementById("edit-id").value = row.dataset.id;
      document.getElementById("edit-title").value = cells[0].textContent;
      document.getElementById("edit-amount").value = cells[1].textContent;
      document.getElementById("edit-category").value = cells[2].textContent.trim();
      document.getElementById("edit-date").value = cells[3].textContent;
      const modal = new bootstrap.Modal(document.getElementById("edit-modal"));
      modal.show();
    });
  });
}

function getCategoryTotals(expenses) {
  const totals = expenses.reduce((acc, expense) => {
    const cat = expense.category;
    acc[cat] = (acc[cat] || 0) + Number(expense.amount);
    return acc;
  }, {});

  return {
    labels: CATEGORIES,
    data: CATEGORIES.map((cat) => totals[cat] || 0),
  };
}

function renderChart(expenses) {
  const { labels, data } = getCategoryTotals(expenses);
  const ctx = document.getElementById("category-chart");

  if (categoryChart) {
    categoryChart.destroy();
  }

  const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
  const colors = isDark ? darkColors : lightColors;

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: labels.map((label) => colors[label] || "#6c757d"),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Expenses by Category" },
      },
    },
  });
}

async function refresh() {
  try {
    showSpinner(true);
    allExpenses = await getExpenses();
    renderSummary(allExpenses);
    renderChart(allExpenses);
    applyFilters();
  } catch (err) {
    showErrorAlert(err.message || "Could not load expenses. Is the server running?");
  } finally {
    showSpinner(false);
  }
}

const themeBtn = document.getElementById("theme-btn");

function updateThemeButton(theme) {
  if (!themeBtn) return;
  if (theme === "dark") {
    themeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-brightness-high" viewBox="0 0 16 16">
        <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
      </svg> Light`;
  } else {
    themeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-moon" viewBox="0 0 16 16">
        <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286"/>
      </svg> Dark`;
  }
}

const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-bs-theme", savedTheme);
updateThemeButton(savedTheme);

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-bs-theme");
    const newTheme = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-bs-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeButton(newTheme);
    renderChart(allExpenses);
  });
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const data = {
    title: document.getElementById("title").value.trim(),
    amount: Number(document.getElementById("amount").value),
    category: document.getElementById("category").value,
    date: document.getElementById("date").value,
  };

  try {
    showSpinner(true);
    await addExpense(data);
    form.reset();
    form.classList.remove("was-validated");
    await refresh();
  } catch (err) {
    showErrorAlert(err.message);
  } finally {
    showSpinner(false);
  }
});

document.getElementById("save-changes").addEventListener("click", async () => {
  const form = document.getElementById("edit-form");
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const id = document.getElementById("edit-id").value;
  const data = {
    title: document.getElementById("edit-title").value.trim(),
    amount: Number(document.getElementById("edit-amount").value),
    category: document.getElementById("edit-category").value,
    date: document.getElementById("edit-date").value,
  };

  try {
    showSpinner(true);
    await updateExpense(id, data);
    const modal = bootstrap.Modal.getInstance(document.getElementById("edit-modal"));
    modal.hide();
    form.classList.remove("was-validated");
    await refresh();
  } catch (err) {
    showErrorAlert(err.message);
  } finally {
    showSpinner(false);
  }
});

document.getElementById("search-title").addEventListener("input", applyFilters);
document.getElementById("month-filter").addEventListener("change", applyFilters);
document.getElementById("category-filter").addEventListener("change", applyFilters);

document.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const field = th.dataset.sort;
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }
    applyFilters();
  });
});

document.getElementById("export-btn").addEventListener("click", async () => {
  try {
    const expenses = allExpenses.length ? allExpenses : await getExpenses();
    const headers = ["Title", "Amount", "Category", "Date"];
    const rows = expenses.map((exp) =>
      [
        `"${String(exp.title).replace(/"/g, '""')}"`,
        Number(exp.amount).toFixed(2),
        exp.category,
        exp.date,
      ].join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    link.download = "expenses.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    showErrorAlert("Could not export CSV: " + err.message);
  }
});

(() => {
  document.querySelectorAll(".needs-validation").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add("was-validated");
    });
  });
})();

refresh();