---
title: Substitutions: Bernoulli and homogeneous equations
summary: Change variables to turn an unfamiliar equation into a linear or separable one.
order: 5
method: [bernoulli, homogeneous]
---

A good substitution turns an equation you can't solve into one you can. Two classic patterns:

## Bernoulli equations

:::definition Bernoulli equation
$$y' + P(x)\,y = Q(x)\,y^n, \qquad n \neq 0, 1.$$
:::

It's nonlinear because of $y^n$, but the substitution $v = y^{1-n}$ makes it linear.

**Why it works.** $v' = (1-n)y^{-n}y'$. Divide the equation by $y^n$:
$$y^{-n}y' + P\,y^{1-n} = Q \quad\Longrightarrow\quad \frac{1}{1-n}v' + Pv = Q,$$
which is linear in $v$: $v' + (1-n)Pv = (1-n)Q$.

:::example
Solve $y' + y = xy^3$.

**Solution.** $n = 3$, so let $v = y^{-2}$. The equation becomes $v' - 2v = -2x$. With $\mu = e^{-2x}$: $(e^{-2x}v)' = -2xe^{-2x}$, so $e^{-2x}v = xe^{-2x} + \tfrac12 e^{-2x} + C$, i.e. $v = x + \tfrac12 + Ce^{2x}$. Finally $y = \pm\left(x + \tfrac12 + Ce^{2x}\right)^{-1/2}$, and $y = 0$ is also a solution.
:::

```solve
y' + y = x y^3
```

## Homogeneous equations (functions of y/x)

:::definition Homogeneous equation
A first-order equation is **homogeneous** if it can be written as $\dfrac{dy}{dx} = F\!\left(\dfrac{y}{x}\right)$. Equivalently, replacing $x \to tx$ and $y \to ty$ leaves the right-hand side unchanged.
:::

(This is a different use of the word "homogeneous" than in "homogeneous linear equation". Context tells you which one is meant.)

**Substitute** $v = y/x$, so $y = vx$ and $y' = v + xv'$. Then
$$v + x\frac{dv}{dx} = F(v) \quad\Longrightarrow\quad \frac{dv}{F(v) - v} = \frac{dx}{x},$$
which is separable.

:::example
Solve $\dfrac{dy}{dx} = \dfrac{x^2 + y^2}{xy}$.

**Solution.** Dividing top and bottom by $x^2$: $F(v) = \dfrac{1 + v^2}{v}$. Then $F(v) - v = \dfrac1v$, so $v\,dv = \dfrac{dx}{x}$. Integrating, $\dfrac{v^2}{2} = \ln|x| + C$, and with $v = y/x$:
$$y^2 = 2x^2(\ln|x| + C).$$
:::

```solve
dy/dx = (x^2 + y^2)/(x y)
```
