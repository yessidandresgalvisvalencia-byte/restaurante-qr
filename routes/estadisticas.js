const express = require("express");
const router = express.Router();

const Pedido = require("../models/pedido");

router.get("/pareto", async (req, res) => {
  try {
    const restaurantId = req.query.restaurantId || req.query.restaurant || "rest1";

    const datos = await Pedido.aggregate([
      {
        $match: {
          restaurantId: restaurantId
        }
      },
      {
        $group: {
          _id: "$producto",
          ventas: { $sum: 1 },
          totalDinero: { $sum: "$precio" }
        }
      },
      {
        $project: {
          _id: 0,
          producto: "$_id",
          ventas: 1,
          totalDinero: 1
        }
      },
      {
        $sort: { ventas: -1 }
      }
    ]);

    res.json(datos);
  } catch (error) {
    console.error("Error en estadísticas:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

module.exports = router;