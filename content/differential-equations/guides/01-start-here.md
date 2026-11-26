---
title: Start here: what is a differential equation?
summary: The vocabulary you need before solving anything, order, linearity, solutions, and initial value problems.
order: 1
method: []
---

A **differential equation** is an equation that involves an unknown function and one or more of its derivatives. Instead of asking "which number makes this true?", it asks "which *function* makes this true?"

For example, the equation

$$\frac{dy}{dx} = 2y$$

says: *the rate at which $y$ changes is always twice its current value*. The function $y = e^{2x}$ works, because its derivative is $2e^{2x} = 2y$. So does $y = 5e^{2x}$, and in fact $y = Ce^{2x}$ for any constant $C$.

:::definition Solution
A **solution** of a differential equation on an interval is a function that, when substituted into the equation, makes it true at every point of that interval.
:::

## Order

:::definition Order
The **order** of a differential equation is the order of the highest derivative that appears.
:::

- $y' = x^2 - y$ is **first order**.
- $y'' + 4y = \sin x$ is **second order**.

A first-order equation usually has a one-parameter family of solutions (one constant $C$). A second-order equation usually needs two constants, $C_1$ and $C_2$.

## Linear vs. nonlinear

:::definition Linear equation
An equation is **linear** if the unknown function and its derivatives appear only to the first power, are not multiplied together, and are not inside other functions. Its coefficients may depend on $x$.
:::

| Equation | Linear? | Why |
|---|---|---|
| $y' + x^2 y = e^x$ | yes | $y$ and $y'$ appear to the first power |
| $y'' - 3y' + 2y = 0$ | yes | constant coefficients |
| $y' = y^2$ | no | $y$ is squared |
| $y'' + \sin y = 0$ | no | $y$ is inside $\sin$ |

Linear equations have a well-developed theory and reliable solution methods. Many nonlinear equations can still be solved exactly when they have special structure (separable, exact, Bernoulli...).

## General and particular solutions

The **general solution** is the whole family, written with arbitrary constants. A **particular solution** is one member of the family, picked out by extra information.

:::definition Initial value problem
An **initial value problem** (IVP) is a differential equation together with conditions on the solution at one point, such as $y(0) = 1$ for a first-order equation, or $y(0) = 1,\ y'(0) = 0$ for a second-order one.
:::

:::example Picking out a particular solution
Solve $y' = 2y$ with $y(0) = 3$.

**Solution.** The general solution is $y = Ce^{2x}$. Setting $x = 0$ gives $3 = Ce^0 = C$, so the solution of the IVP is $y = 3e^{2x}$.
:::

```solve
y' = 2y, y(0) = 3
```

## How to approach a first-order equation

When you meet $\dfrac{dy}{dx} = f(x, y)$, check for structure in roughly this order:

1. **Does $f$ depend only on $x$?** Integrate directly.
2. **Does $f$ factor as $g(x)h(y)$?** It is [separable](#/differential-equations/guide/separable).
3. **Is it $y' + P(x)y = Q(x)$?** It is [linear](#/differential-equations/guide/linear): use an integrating factor.
4. **Written as $M\,dx + N\,dy = 0$ with $M_y = N_x$?** It is [exact](#/differential-equations/guide/exact).
5. **Is it $y' + Py = Qy^n$, or a function of $y/x$?** Use a [substitution](#/differential-equations/guide/substitutions).

The solver follows the same checklist and tells you which tests passed.

:::tip Slope fields
Even when you can't solve an equation, you can *see* it. At each point $(x, y)$ the equation $y' = f(x,y)$ tells you the slope of the solution through that point. Drawing short segments with those slopes gives a **slope field**, and solutions are curves that follow it. Every solver result includes one.
:::
