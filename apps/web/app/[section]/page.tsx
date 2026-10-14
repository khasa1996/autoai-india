import { notFound } from "next/navigation";
import { Catalogue } from "../../components/Catalogue";
import { CustomerTools } from "../../components/CustomerTools";
import { Operations } from "../../components/Operations";
import { Studio } from "../../components/Studio";
import { VehicleDetail } from "../../components/VehicleDetail";

const customer = new Set([
  "account",
  "advisor",
  "compare",
  "exchange",
  "finance",
  "garage",
  "support",
  "tracking",
]);

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { section } = await params;
  if (section === "vehicle")
    return (
      <div className="section page-shell">
        <VehicleDetail id={(await searchParams).id} />
      </div>
    );
  if (section === "explore" || section === "manufacturers")
    return (
      <div className="section page-shell">
        <div className="page-intro">
          <p className="eyebrow">THE REVIEWED CATALOGUE</p>
          <h1>
            {section === "manufacturers"
              ? "Explore manufacturers."
              : "Find the car that fits."}
          </h1>
          <p className="lead">
            Search reviewed, source-attributed records. No invented prices or
            availability.
          </p>
        </div>
        <Catalogue manufacturers={section === "manufacturers"} />
      </div>
    );
  if (customer.has(section))
    return (
      <div className="section page-shell">
        <CustomerTools section={section} />
      </div>
    );
  if (section === "dealer" || section === "admin")
    return (
      <div className="section page-shell">
        <Operations section={section} />
      </div>
    );
  if (section === "showroom" || section === "studio")
    return (
      <div className="section page-shell">
        <Studio />
      </div>
    );
  if (section === "about")
    return (
      <div className="section page-shell">
        <div className="page-intro">
          <p className="eyebrow">INDEPENDENT BY DESIGN</p>
          <h1>A more considered way to choose.</h1>
          <p className="lead">
            An evidence-led path from discovery to a dealer booking request.
          </p>
        </div>
        <section className="prose panel">
          <h2>Clear information before commitment.</h2>
          <p>
            Catalogue facts carry a reviewed source. Advisor results exclude
            incomplete records. Inventory becomes bookable only after an
            accepted dealer records fresh stock.
          </p>
          <h2>Responsibilities stay visible.</h2>
          <p>
            AutoAI India facilitates discovery and booking requests. Authorized
            dealerships remain responsible for vehicle sales, contracts,
            registration and delivery. Payments and private documents are not
            enabled.
          </p>
        </section>
      </div>
    );
  if (section === "terms")
    return (
      <div className="section page-shell">
        <div className="page-intro">
          <p className="eyebrow">TERMS & ASSET POLICY</p>
          <h1>Independent, transparent and unbranded.</h1>
          <p className="lead">
            How AutoAI India presents concept media, catalogue facts and dealer
            services.
          </p>
        </div>
        <section className="prose panel">
          <h2>Independent platform</h2>
          <p>
            AutoAI India is an independent discovery and booking-facilitation
            platform. It is not a vehicle manufacturer, authorized
            representative or owner of third-party vehicle designs. Dealers
            remain responsible for sales, contracts, registration, delivery and
            warranties.
          </p>
          <h2>Images and 3D models</h2>
          <p>
            Showcase media and configurator assets published by AutoAI India are
            original, AI-generated or otherwise used under documented
            permission. Concept assets are deliberately unbranded: they contain
            no manufacturer names, model names, logos, badges or claims of
            association. AI-generated media is illustrative and may not
            represent a production vehicle.
          </p>
          <h2>Catalogue and pricing</h2>
          <p>
            Factual catalogue records must carry a review source and date.
            Prices are estimates or source-attributed figures until a dealer
            supplies a binding quotation. Availability and delivery dates
            require current dealer confirmation.
          </p>
          <h2>Third-party rights</h2>
          <p>
            Open web access does not by itself grant reuse rights. Any
            third-party asset must have a documented licence or permission
            before publication. Names, marks and designs remain the property of
            their respective owners.
          </p>
          <h2>Finance, AI and transactions</h2>
          <p>
            Calculators and recommendations are informational. They are not
            financial advice, credit approval or a sale commitment. Where AI is
            used, outputs may contain errors and should be checked against
            reviewed records. Payments and document collection remain
            unavailable until approved providers and safeguards are connected.
          </p>
        </section>
      </div>
    );
  if (section === "news")
    return (
      <div className="section page-shell">
        <div className="page-intro">
          <p className="eyebrow">AUTOMOTIVE NEWS</p>
          <h1>Context worth trusting.</h1>
          <p className="lead">
            A source-attributed newsroom is planned. No articles are published
            until editorial workflows and sources are ready.
          </p>
        </div>
        <div className="empty-state">The newsroom is being prepared.</div>
      </div>
    );
  notFound();
}
