# 🏗️ Kabllix ERP — Système de Gestion Commerciale & Point de Vente (POS)

<p align="center">
  <!-- Frontend Stack -->
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-v7.9-CA4245?style=for-the-badge&logo=react-router&logoColor=white" alt="React Router 7" /></a>
  <a href="https://recharts.org/"><img src="https://img.shields.io/badge/Recharts-Analytics-22B5BF?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="Recharts" /></a>
  <a href="https://axios-http.com/"><img src="https://img.shields.io/badge/Axios-HTTP_Client-5A29E4?style=for-the-badge&logo=axios&logoColor=white" alt="Axios" /></a>
  <a href="https://lucide.dev/"><img src="https://img.shields.io/badge/Lucide_React-Icons-F56565?style=for-the-badge&logo=feather&logoColor=white" alt="Lucide Icons" /></a>
  <br/>
  <!-- Backend & DevOps Stack -->
  <a href="https://www.oracle.com/java/"><img src="https://img.shields.io/badge/Java-21%20LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" /></a>
  <a href="https://spring.io/projects/spring-boot"><img src="https://img.shields.io/badge/Spring_Boot-4.0%20%2F%203.x-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot" /></a>
  <a href="https://spring.io/projects/spring-security"><img src="https://img.shields.io/badge/Spring_Security-JWT-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white" alt="Spring Security JWT" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
  <a href="https://flywaydb.org/"><img src="https://img.shields.io/badge/Flyway-Migrations-CC0200?style=for-the-badge&logo=flyway&logoColor=white" alt="Flyway" /></a>
  <a href="https://swagger.io/"><img src="https://img.shields.io/badge/OpenAPI_3-Swagger_UI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://junit.org/"><img src="https://img.shields.io/badge/Testing-JUnit_5_%2B_Mockito-25A162?style=for-the-badge&logo=junit5&logoColor=white" alt="Testing" /></a>
</p>

**Kabllix ERP** est une solution logicielle d'entreprise complète, conçue pour digitaliser et sécuriser la gestion des quincailleries, grossistes et commerces de distribution. L'architecture a été pensée pour répondre aux contraintes exigeantes du terrain : haute traçabilité financière, gestion du vrac, architecture multi-magasins, sécurité granulaire et résilience réseau.

---

## 📸 Aperçu de l'Interface

| Tableau de bord analytique | Point de Vente & Caisse |
| :---: | :---: |
| ![Dashboard](Capture%20d'ecrans/Dashboard.png) | ![Vente](Capture%20d'ecrans/Vente.png) |

| Gestion des Stocks & Lots | Reçu de Paiement |
| :---: | :---: |
| ![Stock](Capture%20d'ecrans/Stock.png) | ![Reçu](Capture%20d'ecrans/Recu.png) |

---

## ✨ Fonctionnalités Clés du Domaine Métier

* **📊 Dashboard Décisionnel en Temps Réel** : Visualisation du chiffre d'affaires, marges nettes, état de la trésorerie et alertes de rupture de stock via Recharts.
* **⚡ Point de Vente (POS) Haute Vélocité** : Encaissement rapide, calcul automatique de la monnaie, impression de tickets thermiques et génération de reçus avec QR Code.
* **📦 Traçabilité des Lots & Algorithme FIFO** : Déduction automatique des stocks selon la méthode *First-In, First-Out* pour un suivi rigoureux des arrivages et des dates de péremption.
* **⚖️ Gestion Avancée du Vrac & Unités Complexes** : Prise en charge des unités fractionnables (`BULK` au kg/mètre), lots/boîtes (`BOX`) et unités unitaires (`UNIT`) avec conversion dynamique.
* **🛡️ Système Anti-Fraude & Audit Strict** : Enregistrement immuable de chaque mouvement de stock (`IN`, `OUT`, `ADJUST`) rattaché au caissier et au motif.
* **🏬 Architecture Multi-Boutiques** : Gestion centralisée permettant à un propriétaire de piloter plusieurs points de vente distincts avec isolation des données.
* **📄 Devis & Carnet de Crédit Numérique** : Génération instantanée de devis proforma et suivi des créances clients.

---

## 🏛️ Architecture Technique

Le projet adopte une séparation nette des responsabilités basée sur une **Clean Layered Architecture** :

```
├── backend/                       # Application Java 21 / Spring Boot
│   ├── src/main/java/com/kabllix/api/
│   │   ├── config/                # Sécurité CORS, OpenAPI Swagger, AppConfig
│   │   ├── controller/            # Contrôleurs RESTful (@RestController)
│   │   ├── dto/                   # Data Transfer Objects & Validation Bean (@Valid)
│   │   ├── entity/                # Modèle de domaine JPA / Hibernate
│   │   ├── repository/            # Couche d'accès aux données Spring Data JPA
│   │   ├── security/              # Filtres JWT Stateless & UserDetailsService
│   │   └── service/               # Logique métier transactionnelle (@Transactional)
│   ├── src/main/resources/
│   │   ├── db/migration/          # Migrations SQL versionnées Flyway
│   │   └── application.properties # Paramétrage PostgreSQL et dialectes
│   └── src/test/java/             # Suite de tests unitaires et d'intégration
└── src/                           # Frontend React 19 SPA (Vite)
    ├── components/                # Composants réutilisables & UI
    ├── pages/                     # Modules : sales, inventory, finance, reports
    └── services/                  # Clients HTTP Axios configurés avec intercepteurs JWT
```

---

## 🧪 Qualité & Tests Automatisés (Standards Industriels)

Le système intègre une suite de tests automatisée assurant la robustesse des opérations financières et comptables :

* **Tests Unitaires Métier (`JUnit 5` + `Mockito` + `AssertJ`)** :
  * Calcul sécurisé du Prix de Revient Unitaire (PRU) via `BigDecimal` et `RoundingMode.HALF_UP` (`ProductServiceTest`).
  * Déduction stricte des stocks et application de l'algorithme FIFO sur les lots lors d'une vente (`SaleServiceTest`).
  * Audit des mouvements de stock avec capture d'arguments Mockito (`ArgumentCaptor`).
* **Tests de Couche Web HTTP (`MockMvc`)** :
  * Validation automatique des codes de statut HTTP (`200 OK`, `400 Bad Request` en cas de violation `@NotBlank`).
  * Algorithme de génération et vérification de la clé de contrôle EAN-13 (modulo 10) (`ProductControllerTest`).
* **Environnement de Test Isolé (`H2 Database`)** :
  * Base de données en mémoire dédiée aux tests unitaires, sans dépendance externe, exécutable instantanément en pipeline CI/CD.

---

## 📖 Documentation Interactive de l'API (Swagger / OpenAPI)

L'API est entièrement documentée avec la spécification **OpenAPI 3**. Une fois le backend démarré, l'interface interactive est disponible sur :

```
http://localhost:8080/swagger-ui.html
```

> **Authentification JWT dans Swagger** : Cliquez sur le bouton vert **Authorize**, collez votre token JWT obtenu via `/api/auth/login` et testez directement les routes protégées.

---

## 🚀 Démarrage Rapide

### Prérequis
* [Docker & Docker Compose](https://www.docker.com/) (Recommandé)
* Ou en local : JDK 21+, Node.js 20+, PostgreSQL 16+

### Option 1 : Lancement avec Docker (En 1 commande)

```bash
# 1. Cloner le projet
git clone https://github.com/adammoukit/Stock-Manager.git
cd Stock-Manager

# 2. Démarrer PostgreSQL et le backend Spring Boot
docker compose up -d --build
```

### Option 2 : Lancement en local (Développement)

#### 1. Démarrer le Backend :
```bash
cd backend
# Sur Windows (via IntelliJ ou maven wrapper) :
./mvnw.cmd spring-boot:run
```
*Le backend sera actif sur : `http://localhost:8080`*

#### 2. Démarrer le Frontend :
```bash
# À la racine du projet :
npm install
npm run dev
```
*L'application sera accessible sur : `http://localhost:5173`*

---

## 🔒 Sécurité & Bonnes Pratiques
* Authentification sans état (*Stateless*) basée sur des jetons **JSON Web Tokens (JWT)**.
* Mots de passe hashés avec **BCrypt**.
* Protection contre les injections SQL via requêtes préparées JPA.
* Gestion des migrations de base de données en production avec **Flyway**.
* Filtrage strict des accès par Rôles : `ADMIN`, `MANAGER`, `CASHIER`.

---

## 👤 Auteur : ADAM ABDOU-MOUKIT
**Développeur Fullstack Java / Spring Boot & React**  
*Spécialisé dans les architectures ERP, systèmes de distribution et applications haute disponibilité.*
