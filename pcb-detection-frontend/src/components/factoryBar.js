import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Brain, Home, Hexagon, Award, Factory, Redo2 } from "lucide-react";

const navigation = [
  { name: "HomeFactory", href: "/home-factory", current: false, icon: Home },
  {
    name: "Factory Workflow",
    href: "/factoryWorkflow",
    current: false,
    icon: Factory,
  },
  { name: "Return to HomePage", href: "/", current: false, icon: Redo2 },
  { name: "About Us", href: "/AboutUs", current: false, icon: Award },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function FactoryBar() {
  return (
    <Disclosure
      as="nav"
      className="bg-gray-900/80 backdrop-blur-lg border-b border-cyan-500/20 shadow-lg"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="relative flex h-16 items-center justify-between">
          <div className="absolute inset-y-0 left-0 flex items-center lg:hidden">
            <DisclosureButton className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-cyan-900/30 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 transition-all duration-300">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon className="block h-6 w-6 group-data-[open]:hidden " />
              <XMarkIcon className="hidden h-6 w-6 group-data-[open]:block" />
            </DisclosureButton>
          </div>

          <div className="flex flex-1 items-center justify-center ">
            <div className="flex shrink-0 items-center">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Hexagon
                    className="h-12 w-12 text-cyan-500 opacity-80"
                    strokeWidth={1}
                  />
                  <Brain className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  This PCB is suspicious
                </span>
              </div>
            </div>
            <div className="hidden lg:ml-8 lg:block">
              <div className="flex space-x-1 mt-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={classNames(
                        item.current
                          ? "bg-cyan-900/40 text-cyan-400"
                          : "text-gray-300 hover:bg-gray-800/60 hover:text-white",
                        "group flex items-center rounded-lg px-3 py-2 text-sm font-medium gap-2 transition-all duration-200"
                      )}
                      aria-current={item.current ? "page" : undefined}
                    >
                      <Icon className="h-5 w-5 group-hover:text-cyan-400 transition-colors" />
                      {item.name}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                        <button
                            type="button"
                            className="relative rounded-full bg-gray-800/60 p-1 text-gray-400 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all"
                        >
                            <span className="absolute -inset-1.5" />
                            <span className="sr-only">View notifications</span>
                            <Upload className="h-6 w-6" />
                        </button>
                    </div> */}
        </div>
      </div>

      <DisclosurePanel className="lg:hidden">
        <div className="space-y-1 px-2 pb-3 pt-2 ">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <DisclosureButton
                key={item.name}
                as="a"
                href={item.href}
                className={classNames(
                  item.current
                    ? "bg-cyan-900/40 text-cyan-400"
                    : "text-gray-300 hover:bg-gray-800/60 hover:text-white",
                  "group flex items-center rounded-lg px-3 py-2 text-base font-medium gap-3 transition-all duration-200"
                )}
                aria-current={item.current ? "page" : undefined}
              >
                <Icon className="h-6 w-6 group-hover:text-cyan-400 transition-colors" />
                {item.name}
              </DisclosureButton>
            );
          })}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
