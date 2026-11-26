---
title: Second-order linear equations with constant coefficients
summary: Guess an exponential, solve the characteristic equation, then add a particular solution.
order: 6
method: [constcoef, euler]
---

We study
$$ay'' + by' + cy = g(x),$$
where $a \neq 0$, $b$, $c$ are constants.

:::theorem Structure of the solution
The general solution is
$$y = y_h + y_p,$$
where $y_h = C_1y_1 + C_2y_2$ is the general solution of the **homogeneous** equation $ay'' + by' + cy = 0$ (two independent solutions $y_1, y_2$), and $y_p$ is **any one** particular solution of the full equation.
:::

## Step 1: the homogeneous equation

Try $y = e^{rx}$. Substituting, every term has a factor $e^{rx} \neq 0$, leaving the **characteristic equation**
$$ar^2 + br + c = 0.$$

| Roots | Homogeneous solution |
|---|---|
| two real roots $r_1 \neq r_2$ | $y_h = C_1e^{r_1x} + C_2e^{r_2x}$ |
| one repeated root $r$ | $y_h = (C_1 + C_2x)e^{rx}$ |
| complex roots $\alpha \pm \beta i$ | $y_h = e^{\alpha x}(C_1\cos\beta x + C_2\sin\beta x)$ |

:::note Where do sine and cosine come from?
Euler's formula $e^{i\theta} = \cos\theta + i\sin\theta$ gives $e^{(\alpha + \beta i)x} = e^{\alpha x}(\cos\beta x + i\sin\beta x)$. The real and imaginary parts are each real solutions.
:::

```solve
y'' - 3y' + 2y = 0, y(0) = 1, y'(0) = 0
```

```solve
y'' + 2y' + 5y = 0
```

## Step 2: a particular solution

### Undetermined coefficients

When $g(x)$ is built from polynomials, $e^{kx}$, $\sin\beta x$ and $\cos\beta x$, guess a $y_p$ of the same shape with unknown coefficients:

| $g(x)$ | Guess for $y_p$ |
|---|---|
| polynomial of degree $n$ | $A_0 + A_1x + \dots + A_nx^n$ |
| $e^{kx}$ | $Ae^{kx}$ |
| $\cos\beta x$ or $\sin\beta x$ | $A\cos\beta x + B\sin\beta x$ |
| products of these | products of the guesses |

:::warning The modification rule
If your guess already solves the homogeneous equation, multiply it by $x$ (or by $x^2$ if the root is repeated). For example, for $y'' + 4y = \sin 2x$ the guess $A\cos 2x + B\sin 2x$ is a homogeneous solution, so use $x(A\cos 2x + B\sin 2x)$. This is **resonance**.
:::

```solve
y'' + 4y = sin(2x)
```

### Variation of parameters

For other forcing terms, such as $\sec x$ or $\tan x$, look for $y_p = u_1y_1 + u_2y_2$. With the Wronskian $W = y_1y_2' - y_1'y_2$ and $G = g/a$:
$$u_1' = -\frac{y_2G}{W}, \qquad u_2' = \frac{y_1G}{W}.$$

```solve
y'' + y = sec x
```

## Cauchy–Euler equations

The equation $ax^2y'' + bxy' + cy = 0$ has variable coefficients, but trying $y = x^r$ works: you get $ar(r-1) + br + c = 0$, and the three root cases give $x^{r_1}, x^{r_2}$; $x^r, x^r\ln x$; or $x^\alpha\cos(\beta\ln x), x^\alpha\sin(\beta\ln x)$.

```solve
x^2 y'' + x y' - 4y = 0
```
