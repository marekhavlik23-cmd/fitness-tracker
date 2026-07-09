// Nutrition view — intentional placeholder. The real section arrives with schema v2
// (ft.foods, ft.mealLog, ft.nutritionTargets); this file then gets the actual UI.

export function renderNutrition(el) {
  el.innerHTML = `
    <h2>Jídelníček</h2>
    <div class="card placeholder-card">
      <span class="big-emoji">🍽️</span>
      <h3>Již brzy</h3>
      <p>Evidence jídel, kalorií a bílkovin<br>se chystá v příští verzi.</p>
    </div>`;
}
