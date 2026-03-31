import pandas as pd
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np

# ---------------------------
# Convert mm to float
# ---------------------------
def mm_to_float(value):
    if isinstance(value, str):
        return float(value.replace("mm", "").strip())
    return float(value)

# ---------------------------
# Draw 3D box
# ---------------------------
def draw_box(ax, x, y, z, dx, dy, dz, color, label=None):

    xx = [x, x+dx, x+dx, x, x]
    yy = [y, y, y+dy, y+dy, y]

    kwargs = {'alpha': 0.6, 'color': color}

    ax.plot3D(xx, yy, [z]*5, **kwargs)
    ax.plot3D(xx, yy, [z+dz]*5, **kwargs)

    for i in range(4):
        ax.plot3D([xx[i], xx[i]], [yy[i], yy[i]], [z, z+dz], **kwargs)

    if label:
        ax.text(x, y, z, label, size=8)

# ---------------------------
# Load Data
# ---------------------------

data = pd.read_csv("data.csv")

# Clean numeric columns
for col in ["LenX","LenY","LenZ","X","Y","Z"]:
    data[col] = data[col].apply(mm_to_float)

# Separate levels
wall = data[data["Level"] == 0]
cabinet = data[data["Level"] == 1]
planks = data[data["Level"] == 2]

# ---------------------------
# Create 3D Plot
# ---------------------------

fig = plt.figure(figsize=(10,8))
ax = fig.add_subplot(111, projection='3d')

# ---------------------------
# Draw Wall
# ---------------------------

for _, row in wall.iterrows():
    draw_box(
        ax,
        row.X,
        row.Y,
        row.Z,
        row.LenX,
        row.LenY,
        row.LenZ,
        color='gray',
        label=row["Entity Name"]
    )

# ---------------------------
# Draw Cabinet
# ---------------------------

for _, row in cabinet.iterrows():
    draw_box(
        ax,
        row.X,
        row.Y,
        row.Z,
        row.LenX,
        row.LenY,
        row.LenZ,
        color='blue',
        label=row["Entity Name"]
    )

# ---------------------------
# Draw Planks
# ---------------------------

for _, row in planks.iterrows():

    # Edge case handling
    if row.LenX == 0 or row.LenY == 0 or row.LenZ == 0:
        continue

    color = "green"

    if "217" in str(row.Material):
        color = "orange"

    draw_box(
        ax,
        row.X,
        row.Y,
        row.Z,
        row.LenX,
        row.LenY,
        row.LenZ,
        color=color,
        label=row["Entity Name"]
    )

# ---------------------------
# Labels
# ---------------------------

ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Z')

plt.title("NestUp 3D Cabinet Model")

plt.show()