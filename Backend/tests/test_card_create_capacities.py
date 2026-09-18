"""Unity / editor capacity keys must land on the same DB columns."""

from app.routers.card_manager import CardCreate


def _pilot(extra: dict) -> CardCreate:
    body = {"ID": 262161, "is_pilot": True, "card_name": "Eri Loth'laundil"}
    body.update(extra)
    return CardCreate.model_validate(body)


def test_unity_tim_capacity_uppercase_writes_time_not_metal():
    card = _pilot({"TIM_capacity": 1, "spirit_capacity": 1})
    assert card.time_capacity == 1
    assert card.spirit_capacity == 1
    assert card.metal_capacity == 0


def test_unity_time_capacity_pascal_writes_time():
    card = _pilot({"Time_capacity": 1, "Spirit_capacity": 1})
    assert card.time_capacity == 1
    assert card.spirit_capacity == 1


def test_tim_and_zero_time_capacity_keeps_the_nonzero_pip():
    card = _pilot({"time_capacity": 0, "tim_capacity": 1, "metal_capacity": 0})
    assert card.time_capacity == 1
    assert card.metal_capacity == 0


def test_met_capacity_stays_metal_and_does_not_steal_time():
    card = _pilot({"MET_capacity": 1, "TIM_capacity": 1})
    assert card.metal_capacity == 1
    assert card.time_capacity == 1


def test_short_codes_match_the_long_column_names():
    card = _pilot(
        {
            "pow_capacity": 1,
            "met_capacity": 1,
            "stl_capacity": 1,
            "tim_capacity": 1,
            "ram_capacity": 1,
            "spirit_capacity": 1,
        }
    )
    assert card.power_capacity == 1
    assert card.metal_capacity == 1
    assert card.steel_capacity == 1
    assert card.time_capacity == 1
    assert card.ram_capacity == 1
    assert card.spirit_capacity == 1
